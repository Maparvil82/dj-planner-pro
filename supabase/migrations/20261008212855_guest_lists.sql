-- Named groups share the existing individual admission ledger, never a separate counter.
alter table public.event_ticket_types add column is_guest_list boolean not null default false;
create unique index event_ticket_types_guest_list on public.event_ticket_types(session_id) where is_guest_list;
create table public.event_guest_groups (
 id uuid primary key,
 session_id uuid not null references public.sessions(id) on delete cascade,
 full_name text not null check(length(btrim(full_name)) between 2 and 120),
 companions integer not null check(companions between 0 and 99),
 revision integer not null default 1,
 created_at timestamptz not null default now(),
 unique(id,session_id)
);
create index event_guest_groups_session on public.event_guest_groups(session_id);
alter table public.event_guest_groups enable row level security;
revoke all on public.event_guest_groups from public,anon,authenticated;
grant select on public.event_guest_groups to authenticated;
create policy organizer_guest_groups on public.event_guest_groups for select to authenticated using (
 exists(select 1 from public.sessions s where s.id=session_id and s.user_id=(select auth.uid()))
);
alter table public.event_tickets add column guest_id uuid;
alter table public.event_tickets add constraint event_tickets_guest_session foreign key(guest_id,session_id) references public.event_guest_groups(id,session_id) on delete cascade;
create index event_tickets_guest on public.event_tickets(guest_id,session_id) where guest_id is not null;
create table ticketing_private.guest_operations (
 id uuid primary key,
 session_id uuid not null references public.sessions(id) on delete cascade,
 guest_id uuid not null,
 action text not null,
 quantity integer not null
);
alter table ticketing_private.guest_operations enable row level security;
revoke all on ticketing_private.guest_operations from public,anon,authenticated;
create index guest_operations_session on ticketing_private.guest_operations(session_id);

create function ticketing_private.save_guest(p_session uuid,p_guest uuid,p_name text,p_companions integer,p_revision integer)
returns public.event_guest_groups language plpgsql security definer set search_path='' as $$
declare g public.event_guest_groups; kind uuid; active_count integer; used_count integer; next_ordinal integer;
begin
 perform 1 from public.sessions where id=p_session and user_id=auth.uid() and status is distinct from 'cancelled' for update;
 if not found or auth.uid() is null then raise exception 'tickets.unavailable'; end if;
 if p_guest is null or p_name is null or length(btrim(p_name)) not between 2 and 120 or p_companions is null or p_companions not between 0 and 99 or p_revision is null then raise exception 'guests.invalid'; end if;
 select * into g from public.event_guest_groups where id=p_guest;
 if found then
   if g.session_id<>p_session then raise exception 'tickets.unavailable'; end if;
   -- Retrying a successful save is safe even after a lost response.
   if g.full_name=btrim(p_name) and g.companions=p_companions then return g; end if;
   if g.revision<>p_revision then raise exception 'guests.changed'; end if;
 else
   if p_revision<>0 then raise exception 'guests.changed'; end if;
   insert into public.event_guest_groups(id,session_id,full_name,companions) values(p_guest,p_session,btrim(p_name),p_companions) returning * into g;
 end if;
 select count(*) filter(where state<>'cancelled'), count(*) filter(where state='used') into active_count,used_count from public.event_tickets where guest_id=p_guest;
 if used_count>p_companions+1 then raise exception 'guests.belowAdmitted'; end if;
 select id into kind from public.event_ticket_types where session_id=p_session and is_guest_list;
 if kind is null then
   -- Internal type has a unique name even if a user already created a similarly named invitation.
   insert into public.event_ticket_types(session_id,name,price,is_invitation,is_guest_list)
   values(p_session,'Guest list '||p_session::text,0,true,true) returning id into kind;
 end if;
 if active_count>p_companions+1 then
   update public.event_tickets set state='cancelled' where id in (
     select id from public.event_tickets where guest_id=p_guest and state='issued' order by ordinal desc limit active_count-(p_companions+1)
   );
 elsif active_count<p_companions+1 then
   select coalesce(max(ordinal),0) into next_ordinal from public.event_tickets where guest_id=p_guest;
   insert into public.event_tickets(session_id,type_id,batch_id,ordinal,payment_status,guest_id)
   select p_session,kind,p_guest,next_ordinal+n,'invitation',p_guest from pg_catalog.generate_series(1,p_companions+1-active_count) n;
 end if;
 update public.event_guest_groups set full_name=btrim(p_name),companions=p_companions,revision=revision+1 where id=p_guest returning * into g;
 return g;
end $$;

create function ticketing_private.guest_access(p_session uuid,p_guest uuid,p_action text,p_quantity integer,p_request uuid)
returns void language plpgsql security definer set search_path='' as $$
declare prior ticketing_private.guest_operations; available integer;
begin
 perform 1 from public.sessions where id=p_session and user_id=auth.uid() and status is distinct from 'cancelled' for update;
 if not found or auth.uid() is null then raise exception 'tickets.unavailable'; end if;
 if p_request is null or p_action is null or p_action not in ('admit','undo') or p_quantity is null or p_quantity not between 1 and 100 then raise exception 'guests.invalid'; end if;
 select * into prior from ticketing_private.guest_operations where id=p_request;
 if found then
   if prior.session_id<>p_session or prior.guest_id<>p_guest or prior.action<>p_action or prior.quantity<>p_quantity then raise exception 'guests.invalid'; end if;
   return;
 end if;
 if not exists(select 1 from public.event_guest_groups where id=p_guest and session_id=p_session) then raise exception 'tickets.unavailable'; end if;
 select count(*) into available from public.event_tickets where guest_id=p_guest and state=case when p_action='admit' then 'issued' else 'used' end;
 if p_quantity>available then raise exception 'guests.changed'; end if;
 update public.event_tickets set state=case when p_action='admit' then 'used' else 'issued' end,
 checked_in_at=case when p_action='admit' then clock_timestamp() else null end where id in (
   select id from public.event_tickets where guest_id=p_guest and state=case when p_action='admit' then 'issued' else 'used' end
   order by checked_in_at desc nulls last,ordinal limit p_quantity
 );
 insert into ticketing_private.guest_operations values(p_request,p_session,p_guest,p_action,p_quantity);
end $$;

create function ticketing_private.remove_guest(p_session uuid,p_guest uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.sessions where id=p_session and user_id=auth.uid() for update;
 if not found or auth.uid() is null then raise exception 'tickets.unavailable'; end if;
 if not exists(select 1 from public.event_guest_groups where id=p_guest and session_id=p_session) then return; end if;
 if exists(select 1 from public.event_tickets where guest_id=p_guest and state='used') then raise exception 'guests.cannotRemove'; end if;
 delete from public.event_guest_groups where id=p_guest and session_id=p_session;
end $$;

create function public.save_event_guest(p_session uuid,p_guest uuid,p_name text,p_companions integer,p_revision integer)
returns public.event_guest_groups language sql security invoker set search_path='' as $$ select ticketing_private.save_guest(p_session,p_guest,p_name,p_companions,p_revision) $$;
create function public.register_guest_access(p_session uuid,p_guest uuid,p_action text,p_quantity integer,p_request uuid)
returns void language sql security invoker set search_path='' as $$ select ticketing_private.guest_access(p_session,p_guest,p_action,p_quantity,p_request) $$;
create function public.remove_event_guest(p_session uuid,p_guest uuid) returns void
language sql security invoker set search_path='' as $$ select ticketing_private.remove_guest(p_session,p_guest) $$;
create function public.event_guest_list(p_session uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(r order by lower(r.full_name),r.id),'[]'::jsonb) from (
 select g.*,count(e.id) filter(where e.state<>'cancelled') as total,
 count(e.id) filter(where e.state='used') as admitted
 from public.event_guest_groups g left join public.event_tickets e on e.guest_id=g.id where g.session_id=p_session group by g.id
 ) r
$$;
revoke all on function ticketing_private.save_guest(uuid,uuid,text,integer,integer),ticketing_private.guest_access(uuid,uuid,text,integer,uuid),ticketing_private.remove_guest(uuid,uuid) from public,anon;
grant execute on function ticketing_private.save_guest(uuid,uuid,text,integer,integer),ticketing_private.guest_access(uuid,uuid,text,integer,uuid),ticketing_private.remove_guest(uuid,uuid) to authenticated;
revoke all on function public.save_event_guest(uuid,uuid,text,integer,integer),public.register_guest_access(uuid,uuid,text,integer,uuid),public.remove_event_guest(uuid,uuid),public.event_guest_list(uuid) from public,anon;
grant execute on function public.save_event_guest(uuid,uuid,text,integer,integer),public.register_guest_access(uuid,uuid,text,integer,uuid),public.remove_event_guest(uuid,uuid),public.event_guest_list(uuid) to authenticated;

-- Guest group capacity can only be changed through the checked group functions.
create or replace function ticketing_private.issue(p_session uuid,p_type uuid,p_quantity integer,p_payment text,p_batch uuid)
returns setof public.event_tickets language plpgsql security definer set search_path='' as $$
declare kind public.event_ticket_types;
begin
 -- Serialize issue calls and retry the same batch without creating more tickets.
 perform 1 from public.sessions where id=p_session and user_id=auth.uid() and status is distinct from 'cancelled' for update;
 if not found or auth.uid() is null then raise exception 'tickets.unavailable'; end if;
 if p_quantity is null or p_quantity<1 or p_quantity>100 or p_batch is null or p_payment is null or p_payment not in ('paid','pending','invitation') then raise exception 'tickets.invalidIssue'; end if;
 select * into kind from public.event_ticket_types where id=p_type and session_id=p_session;
 if not found or kind.is_guest_list or (kind.is_invitation and p_payment<>'invitation') or (not kind.is_invitation and p_payment='invitation') then raise exception 'tickets.invalidIssue'; end if;
 if exists(select 1 from public.event_tickets where session_id=p_session and batch_id=p_batch) then
   if (select count(*) from public.event_tickets where session_id=p_session and batch_id=p_batch)<>p_quantity
      or exists(select 1 from public.event_tickets where session_id=p_session and batch_id=p_batch and type_id<>p_type) then raise exception 'tickets.invalidIssue'; end if;
   return query select * from public.event_tickets where session_id=p_session and batch_id=p_batch order by ordinal;
   return;
 end if;
 return query insert into public.event_tickets(session_id,type_id,batch_id,ordinal,payment_status)
 select p_session,p_type,p_batch,n,p_payment from pg_catalog.generate_series(1,p_quantity) n returning *;
end $$;


-- Keep guest capacity changes inside the group workflow.
create or replace function ticketing_private.change_ticket(p_session uuid,p_ticket uuid,p_action text)
returns public.event_tickets language plpgsql security definer set search_path='' as $$
declare ticket public.event_tickets;
begin
 perform 1 from public.sessions where id=p_session and user_id=auth.uid() for update;
 if not found or auth.uid() is null then raise exception 'tickets.unavailable'; end if;
 select * into ticket from public.event_tickets where id=p_ticket and session_id=p_session for update;
 if not found or ticket.guest_id is not null then raise exception 'tickets.cannotChange'; end if;
 if p_action='paid' and ticket.payment_status='paid' and ticket.state<>'cancelled' then return ticket; end if;
 if p_action='cancel' and ticket.state='cancelled' then return ticket; end if;
 if ticket.state<>'issued' then raise exception 'tickets.cannotChange'; end if;
 if p_action='cancel' then update public.event_tickets set state='cancelled' where id=p_ticket returning * into ticket;
 elsif p_action='paid' and ticket.payment_status='pending' then update public.event_tickets set payment_status='paid' where id=p_ticket returning * into ticket;
 else raise exception 'tickets.cannotChange'; end if;
 return ticket;
end $$;


create or replace function public.event_ticket_summary(p_session uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('issued',count(*),'accepted',count(*) filter(where e.state='used'),
 'paid',count(*) filter(where e.state<>'cancelled' and e.payment_status='paid'),
 'pending',count(*) filter(where e.state<>'cancelled' and e.payment_status='pending'),
 'invited',count(*) filter(where e.state<>'cancelled' and e.payment_status='invitation'),
 'cancelled',count(*) filter(where e.state='cancelled'),
 'revenue',coalesce(sum(k.price) filter(where e.payment_status='paid'),0),
 'cancelled_paid_amount',coalesce(sum(k.price) filter(where e.state='cancelled' and e.payment_status='paid'),0),
 'by_type',coalesce((select jsonb_agg(r) from (
 select k.id,k.name,k.price,k.is_invitation,k.is_guest_list,count(e.id) filter(where e.state<>'cancelled') as issued,
 count(e.id) filter(where e.state='used') as accepted,
 count(e.id) filter(where e.state<>'cancelled' and e.payment_status='paid') as paid,
 count(e.id) filter(where e.state<>'cancelled' and e.payment_status='pending') as pending
 from public.event_ticket_types k left join public.event_tickets e on e.type_id=k.id
 where k.session_id=p_session group by k.id order by k.created_at) r),'[]'::jsonb))
 from public.event_tickets e join public.event_ticket_types k on k.id=e.type_id where e.session_id=p_session
$$;
