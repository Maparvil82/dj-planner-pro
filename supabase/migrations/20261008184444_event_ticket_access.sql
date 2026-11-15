-- QR tickets are private to the session organizer. Writes only through checked RPCs.
create schema if not exists ticketing_private;
revoke all on schema ticketing_private from public, anon;
grant usage on schema ticketing_private to authenticated;

create table public.event_ticket_types (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references public.sessions(id) on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 80),
 price numeric(12,2) not null check(price>=0 and price<=1000000),
 is_invitation boolean not null default false,
 created_at timestamptz not null default now(),
 check(not is_invitation or price=0),
 unique(id,session_id)
);
create index event_ticket_types_session on public.event_ticket_types(session_id);
create unique index event_ticket_types_name on public.event_ticket_types(session_id,lower(btrim(name)));
create table public.event_tickets (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references public.sessions(id) on delete cascade,
 type_id uuid not null,
 token uuid not null unique default gen_random_uuid(),
 batch_id uuid not null,
 ordinal integer not null,
 payment_status text not null check(payment_status in ('paid','pending','invitation')),
 state text not null default 'issued' check(state in ('issued','used','cancelled')),
 checked_in_at timestamptz,
 created_at timestamptz not null default now(),
 foreign key(type_id,session_id) references public.event_ticket_types(id,session_id),
 unique(session_id,batch_id,ordinal),
 check((state='used')=(checked_in_at is not null))
);
create index event_tickets_session_created on public.event_tickets(session_id,created_at desc,id);
create index event_tickets_type on public.event_tickets(type_id,session_id);
alter table public.event_ticket_types enable row level security;
alter table public.event_tickets enable row level security;
revoke all on public.event_ticket_types,public.event_tickets from public,anon,authenticated;
grant select on public.event_ticket_types,public.event_tickets to authenticated;
create policy organizer_types on public.event_ticket_types for select to authenticated using (
 exists(select 1 from public.sessions s where s.id=session_id and s.user_id=(select auth.uid()))
);
create policy organizer_tickets on public.event_tickets for select to authenticated using (
 exists(select 1 from public.sessions s where s.id=session_id and s.user_id=(select auth.uid()))
);

create function ticketing_private.add_type(p_session uuid,p_name text,p_price numeric,p_invitation boolean)
returns public.event_ticket_types language plpgsql security definer set search_path='' as $$
declare result public.event_ticket_types;
begin
 if auth.uid() is null or not exists(select 1 from public.sessions where id=p_session and user_id=auth.uid() and status is distinct from 'cancelled') then raise exception 'tickets.unavailable'; end if;
 if p_name is null or p_price is null or p_invitation is null or p_price<>round(p_price,2) then raise exception 'tickets.invalidType'; end if;
 insert into public.event_ticket_types(session_id,name,price,is_invitation) values(p_session,btrim(p_name),p_price,p_invitation) returning * into result;
 return result;
end $$;

create function ticketing_private.issue(p_session uuid,p_type uuid,p_quantity integer,p_payment text,p_batch uuid)
returns setof public.event_tickets language plpgsql security definer set search_path='' as $$
declare kind public.event_ticket_types;
begin
 -- Serialize issue calls and retry the same batch without creating more tickets.
 perform 1 from public.sessions where id=p_session and user_id=auth.uid() and status is distinct from 'cancelled' for update;
 if not found or auth.uid() is null then raise exception 'tickets.unavailable'; end if;
 if p_quantity is null or p_quantity<1 or p_quantity>100 or p_batch is null or p_payment is null or p_payment not in ('paid','pending','invitation') then raise exception 'tickets.invalidIssue'; end if;
 select * into kind from public.event_ticket_types where id=p_type and session_id=p_session;
 if not found or (kind.is_invitation and p_payment<>'invitation') or (not kind.is_invitation and p_payment='invitation') then raise exception 'tickets.invalidIssue'; end if;
 if exists(select 1 from public.event_tickets where session_id=p_session and batch_id=p_batch) then
   if (select count(*) from public.event_tickets where session_id=p_session and batch_id=p_batch)<>p_quantity
      or exists(select 1 from public.event_tickets where session_id=p_session and batch_id=p_batch and type_id<>p_type) then raise exception 'tickets.invalidIssue'; end if;
   return query select * from public.event_tickets where session_id=p_session and batch_id=p_batch order by ordinal;
   return;
 end if;
 return query insert into public.event_tickets(session_id,type_id,batch_id,ordinal,payment_status)
 select p_session,p_type,p_batch,n,p_payment from pg_catalog.generate_series(1,p_quantity) n returning *;
end $$;

create function ticketing_private.check_in(p_session uuid,p_token uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ticket public.event_tickets; kind public.event_ticket_types;
begin
 -- Lock session first: cancellation/deletion cannot race admission.
 perform 1 from public.sessions where id=p_session and user_id=auth.uid() and status is distinct from 'cancelled' for update;
 if not found or auth.uid() is null then raise exception 'tickets.unavailable'; end if;
 select * into ticket from public.event_tickets where token=p_token and session_id=p_session for update;
 if not found then return jsonb_build_object('status','invalid'); end if;
 select * into kind from public.event_ticket_types where id=ticket.type_id;
 if ticket.state='used' then return jsonb_build_object('status','already_used','checked_in_at',ticket.checked_in_at,'type_name',kind.name); end if;
 if ticket.state='cancelled' then return jsonb_build_object('status','cancelled','type_name',kind.name); end if;
 if ticket.payment_status='pending' then return jsonb_build_object('status','pending','ticket_id',ticket.id,'price',kind.price,'type_name',kind.name); end if;
 update public.event_tickets set state='used',checked_in_at=clock_timestamp() where id=ticket.id returning * into ticket;
 return jsonb_build_object('status','accepted','checked_in_at',ticket.checked_in_at,'type_name',kind.name,'payment_status',ticket.payment_status);
end $$;

create function ticketing_private.change_ticket(p_session uuid,p_ticket uuid,p_action text)
returns public.event_tickets language plpgsql security definer set search_path='' as $$
declare ticket public.event_tickets;
begin
 perform 1 from public.sessions where id=p_session and user_id=auth.uid() for update;
 if not found or auth.uid() is null then raise exception 'tickets.unavailable'; end if;
 select * into ticket from public.event_tickets where id=p_ticket and session_id=p_session for update;
 if not found then raise exception 'tickets.cannotChange'; end if;
 if p_action='paid' and ticket.payment_status='paid' and ticket.state<>'cancelled' then return ticket; end if;
 if p_action='cancel' and ticket.state='cancelled' then return ticket; end if;
 if ticket.state<>'issued' then raise exception 'tickets.cannotChange'; end if;
 if p_action='cancel' then update public.event_tickets set state='cancelled' where id=p_ticket returning * into ticket;
 elsif p_action='paid' and ticket.payment_status='pending' then update public.event_tickets set payment_status='paid' where id=p_ticket returning * into ticket;
 else raise exception 'tickets.cannotChange'; end if;
 return ticket;
end $$;

create function public.add_event_ticket_type(p_session uuid,p_name text,p_price numeric,p_invitation boolean)
returns public.event_ticket_types language sql security invoker set search_path='' as $$ select ticketing_private.add_type(p_session,p_name,p_price,p_invitation) $$;
create function public.issue_event_tickets(p_session uuid,p_type uuid,p_quantity integer,p_payment text,p_batch uuid)
returns setof public.event_tickets language sql security invoker set search_path='' as $$ select * from ticketing_private.issue(p_session,p_type,p_quantity,p_payment,p_batch) $$;
create function public.check_in_event_ticket(p_session uuid,p_token uuid)
returns jsonb language sql security invoker set search_path='' as $$ select ticketing_private.check_in(p_session,p_token) $$;
create function public.change_event_ticket(p_session uuid,p_ticket uuid,p_action text)
returns public.event_tickets language sql security invoker set search_path='' as $$ select ticketing_private.change_ticket(p_session,p_ticket,p_action) $$;
create function public.event_ticket_summary(p_session uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('issued',count(*),'accepted',count(*) filter(where e.state='used'),
 'paid',count(*) filter(where e.state<>'cancelled' and e.payment_status='paid'),
 'pending',count(*) filter(where e.state<>'cancelled' and e.payment_status='pending'),
 'invited',count(*) filter(where e.state<>'cancelled' and e.payment_status='invitation'),
 'cancelled',count(*) filter(where e.state='cancelled'),
 'revenue',coalesce(sum(k.price) filter(where e.payment_status='paid'),0),
 'cancelled_paid_amount',coalesce(sum(k.price) filter(where e.state='cancelled' and e.payment_status='paid'),0),
 'by_type',coalesce((select jsonb_agg(r) from (
 select k.id,k.name,k.price,k.is_invitation,count(e.id) filter(where e.state<>'cancelled') as issued,
 count(e.id) filter(where e.state='used') as accepted,
 count(e.id) filter(where e.state<>'cancelled' and e.payment_status='paid') as paid,
 count(e.id) filter(where e.state<>'cancelled' and e.payment_status='pending') as pending
 from public.event_ticket_types k left join public.event_tickets e on e.type_id=k.id
 where k.session_id=p_session group by k.id order by k.created_at) r),'[]'::jsonb))
 from public.event_tickets e join public.event_ticket_types k on k.id=e.type_id where e.session_id=p_session
$$;
revoke all on function ticketing_private.add_type(uuid,text,numeric,boolean),ticketing_private.issue(uuid,uuid,integer,text,uuid),ticketing_private.check_in(uuid,uuid),ticketing_private.change_ticket(uuid,uuid,text) from public,anon;
grant execute on function ticketing_private.add_type(uuid,text,numeric,boolean),ticketing_private.issue(uuid,uuid,integer,text,uuid),ticketing_private.check_in(uuid,uuid),ticketing_private.change_ticket(uuid,uuid,text) to authenticated;
revoke all on function public.add_event_ticket_type(uuid,text,numeric,boolean),public.issue_event_tickets(uuid,uuid,integer,text,uuid),public.check_in_event_ticket(uuid,uuid),public.change_event_ticket(uuid,uuid,text),public.event_ticket_summary(uuid) from public,anon;
grant execute on function public.add_event_ticket_type(uuid,text,numeric,boolean),public.issue_event_tickets(uuid,uuid,integer,text,uuid),public.check_in_event_ticket(uuid,uuid),public.change_event_ticket(uuid,uuid,text),public.event_ticket_summary(uuid) to authenticated;

-- Keep previously issued monetary amounts in their original currency.
create function ticketing_private.guard_currency() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.currency is distinct from old.currency and exists(select 1 from public.event_tickets where session_id=old.id) then
   raise exception 'tickets.currencyLocked';
 end if;
 return new;
end $$;
revoke all on function ticketing_private.guard_currency() from public,anon,authenticated;
create trigger ticket_currency_guard before update of currency on public.sessions
for each row execute function ticketing_private.guard_currency();
