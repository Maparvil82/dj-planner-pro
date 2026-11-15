-- Private communication with promoters who do not need an app account.
-- Retain an agreed event's time zone even if the DJ later changes their settings.
alter table public.sessions add column booking_timezone text;
create schema if not exists booking_private;
revoke all on schema booking_private from public, anon, authenticated;
grant usage on schema booking_private to authenticated, service_role;
create table public.booking_links (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 slug text not null unique check(slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
 enabled boolean not null default false,
 timezone text not null default 'Europe/Madrid',
 default_terms text not null default '' check(length(default_terms)<=3000),
 updated_at timestamptz not null default now()
);
create table public.booking_requests (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 promoter_name text not null check(length(promoter_name) between 1 and 80),
 promoter_email text not null check(length(promoter_email)<=254),
 event_title text not null check(length(event_title) between 1 and 120),
 venue text not null check(length(venue) between 1 and 160), city text not null check(length(city) between 1 and 120),
 date date not null, start_time text not null check(start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 end_time text not null check(end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 budget numeric(12,2) not null check(budget>=0), currency text not null check(currency in ('EUR','USD','GBP')),
 timezone text not null, language text not null default 'es' check(language in ('es','en','de','fr','it','pt','ja')),
 state text not null default 'unverified' check(state in ('unverified','new','negotiating','proposed','accepted','declined','closed')),
 submission_key uuid unique, session_id uuid references public.sessions(id) on delete set null, latest_proposal_id uuid,
 verified_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(start_time<>end_time)
);
create table public.booking_messages (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.booking_requests(id) on delete cascade,
 sender text not null check(sender in ('dj','promoter')), body text not null check(length(body) between 1 and 3000),
 created_at timestamptz not null default now()
);
create table public.booking_proposals (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.booking_requests(id) on delete cascade,
 version integer not null, event_title text not null check(length(event_title) between 1 and 120),
 venue text not null check(length(venue) between 1 and 160), city text not null check(length(city) between 1 and 120),
 date date not null, start_time text not null check(start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 end_time text not null check(end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'), timezone text not null,
 fee numeric(12,2) not null check(fee>=0), currency text not null check(currency in ('EUR','USD','GBP')),
 terms text not null check(length(terms)<=3000), expires_at timestamptz not null,
 hold_until timestamptz, created_at timestamptz not null default now(), unique(request_id,version), check(start_time<>end_time)
);
alter table public.booking_requests add foreign key(latest_proposal_id) references public.booking_proposals(id) on delete set null;
create table booking_private.guest_access (
 token_hash text primary key, request_id uuid not null references public.booking_requests(id) on delete cascade,
 expires_at timestamptz not null, created_at timestamptz not null default now()
);
create table booking_private.runtime_config (id boolean primary key default true check(id), ready boolean not null default false);
insert into booking_private.runtime_config(id,ready) values(true,false);
alter table booking_private.runtime_config enable row level security;
create table booking_private.rate_limits (bucket text primary key, window_start timestamptz not null default now(), attempts integer not null default 1);
create table booking_private.email_outbox (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.booking_requests(id) on delete cascade,
 payload jsonb not null, state text not null default 'pending' check(state in ('pending','sending','sent','failed')),
 attempts integer not null default 0, available_at timestamptz not null default now(), created_at timestamptz not null default now(), sent_at timestamptz
);
create index booking_requests_owner_updated on public.booking_requests(owner_id,updated_at desc,id) where state<>'unverified';
create index booking_requests_session on public.booking_requests(session_id) where session_id is not null;
create index booking_requests_latest on public.booking_requests(latest_proposal_id) where latest_proposal_id is not null;
create index booking_messages_thread on public.booking_messages(request_id,created_at,id);
create index booking_proposals_thread on public.booking_proposals(request_id,version desc);
create index guest_access_thread on booking_private.guest_access(request_id);
create index booking_outbox_due on booking_private.email_outbox(available_at) where state in ('pending','failed','sending');
alter table public.booking_links enable row level security;
alter table public.booking_requests enable row level security;
alter table public.booking_messages enable row level security;
alter table public.booking_proposals enable row level security;
alter table booking_private.guest_access enable row level security;
alter table booking_private.rate_limits enable row level security;
alter table booking_private.email_outbox enable row level security;
revoke all on public.booking_links,public.booking_requests,public.booking_messages,public.booking_proposals from public,anon,authenticated;
grant select on public.booking_links,public.booking_requests,public.booking_messages,public.booking_proposals to authenticated;
grant all on public.booking_links,public.booking_requests,public.booking_messages,public.booking_proposals to service_role;
grant all on all tables in schema booking_private to service_role;
create policy booking_link_owner on public.booking_links for select to authenticated using(owner_id=(select auth.uid()));
create policy booking_request_owner on public.booking_requests for select to authenticated using(owner_id=(select auth.uid()) and state<>'unverified');
create policy booking_message_owner on public.booking_messages for select to authenticated using(exists(select 1 from public.booking_requests r where r.id=request_id and r.owner_id=(select auth.uid()) and r.state<>'unverified'));
create policy booking_proposal_owner on public.booking_proposals for select to authenticated using(exists(select 1 from public.booking_requests r where r.id=request_id and r.owner_id=(select auth.uid()) and r.state<>'unverified'));

alter table public.social_notifications alter column actor_id drop not null;
alter table public.social_notifications add column booking_id uuid references public.booking_requests(id) on delete cascade;
alter table public.social_notifications drop constraint social_notifications_kind_check;
alter table public.social_notifications add constraint social_notifications_kind_check check(kind in ('follow','shared_session','session_invitation','invitation_response','session_update','booking_request','booking_message','booking_confirmed'));
create index social_notifications_booking on public.social_notifications(booking_id) where booking_id is not null;

create function booking_private.slot(d date, start_at text, end_at text, zone text)
returns tstzrange language sql stable set search_path='' as $$
 select tstzrange((d+coalesce(nullif(start_at,'')::time,'00:00'::time)) at time zone zone,
 ((d+coalesce(nullif(end_at,'')::time,'00:00'::time))+case when end_at is null or end_at='' or end_at<=coalesce(start_at,'00:00') then interval '1 day' else interval '0 day' end) at time zone zone,'[)');
$$;
create function booking_private.has_conflict(owner_id uuid, window_range tstzrange, ignore_request uuid default null)
returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from public.sessions s where (s.user_id=has_conflict.owner_id or exists(select 1 from public.session_collaborators c where c.session_id=s.id and c.dj_id=has_conflict.owner_id and c.status='accepted')) and coalesce(s.status,'confirmed')<>'cancelled' and booking_private.slot(s.date,s.start_time,s.end_time,coalesce(s.booking_timezone,(select l.timezone from public.booking_links l where l.owner_id=s.user_id),'Europe/Madrid')) && window_range)
 or exists(select 1 from public.booking_requests r join public.booking_proposals p on p.id=r.latest_proposal_id where r.owner_id=has_conflict.owner_id and r.state='proposed' and r.id is distinct from ignore_request and p.hold_until>now() and p.expires_at>now() and booking_private.slot(p.date,p.start_time,p.end_time,p.timezone) && window_range);
$$;
create function booking_private.snapshot(request_id uuid)
returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('request',to_jsonb(r),'messages',coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at,m.id) from (select * from public.booking_messages where booking_messages.request_id=r.id order by created_at desc,id desc) m),'[]'::jsonb),'proposals',coalesce((select jsonb_agg(to_jsonb(p) order by p.version) from public.booking_proposals p where p.request_id=r.id),'[]'::jsonb)) from public.booking_requests r where r.id=request_id;
$$;
create function booking_private.notify(request_id uuid, activity text)
returns void language sql set search_path='' as $$
 insert into public.social_notifications(recipient_id,actor_id,kind,actor_name,session_title,booking_id,session_id)
 select r.owner_id,null,activity,r.promoter_name,r.event_title,r.id,r.session_id from public.booking_requests r where r.id=request_id;
$$;
create function public.booking_rate_limit(key text, max_attempts integer)
returns boolean language plpgsql security invoker set search_path='' as $$
declare attempts integer;
begin
 insert into booking_private.rate_limits(bucket) values(key) on conflict(bucket) do update set attempts=case when rate_limits.window_start<now()-interval '1 hour' then 1 else rate_limits.attempts+1 end, window_start=case when rate_limits.window_start<now()-interval '1 hour' then now() else rate_limits.window_start end returning rate_limits.attempts into attempts;
 return attempts<=max_attempts;
end; $$;

create function booking_private.dj_action(action text,input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=auth.uid(); r public.booking_requests; p public.booking_proposals; zone text; version_number integer; deadline timestamptz; event_window tstzrange;
begin
 if v_owner is null then raise exception 'not_authenticated'; end if;
 if action='settings' then
  if (input->>'enabled')::boolean and not (select ready from booking_private.runtime_config where id) then raise exception 'service_not_ready'; end if;
  if (input->>'enabled')::boolean and not billing_private.has_pro_access() then raise exception 'pro_required'; end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=input->>'timezone') then raise exception 'invalid_timezone'; end if;
  if (input->>'enabled')::boolean and not exists(select 1 from public.community_profiles c where c.user_id=v_owner and c.is_visible) then raise exception 'public_profile_required'; end if;
  insert into public.booking_links(owner_id,slug,timezone,default_terms,enabled) values(v_owner,input->>'slug',input->>'timezone',coalesce(input->>'default_terms',''),coalesce((input->>'enabled')::boolean,false)) on conflict(owner_id) do update set slug=excluded.slug,timezone=excluded.timezone,default_terms=excluded.default_terms,enabled=excluded.enabled,updated_at=now();
  return (select to_jsonb(l) from public.booking_links l where l.owner_id=v_owner);
 end if;
 select * into r from public.booking_requests where id=(input->>'id')::uuid and booking_requests.owner_id=v_owner and state<>'unverified' for update;
 if r.id is null then raise exception 'request_not_found'; end if;
 if action='read' then return booking_private.snapshot(r.id); end if;
 if r.state in ('declined','closed') or (r.state='accepted' and action<>'message') then raise exception 'request_closed'; end if;
 if action='message' then
  if input->>'body' is null or length(btrim(input->>'body')) not between 1 and 3000 then raise exception 'invalid_message'; end if;
  insert into public.booking_messages(request_id,sender,body) values(r.id,'dj',btrim(input->>'body'));
  update public.booking_requests set updated_at=now() where id=r.id;
 elsif action='decline' or action='close' then
  update public.booking_requests set state=case when action='decline' then 'declined' else 'closed' end,updated_at=now() where id=r.id;
 elsif action='release_hold' then
  if r.state<>'proposed' or r.latest_proposal_id is null then raise exception 'proposal_changed'; end if;
  select * into p from public.booking_proposals where id=r.latest_proposal_id;
  if p.hold_until is null then return booking_private.snapshot(r.id); end if;
  if input->>'body' is null or length(btrim(input->>'body')) not between 1 and 3000 then raise exception 'invalid_message'; end if;
  -- Releasing availability does not change the immutable commercial terms.
  update public.booking_proposals set hold_until=null where id=p.id;
  insert into public.booking_messages(request_id,sender,body) values(r.id,'dj',btrim(input->>'body'));
  update public.booking_requests set updated_at=now() where id=r.id;
 elsif action='propose' then
  if not billing_private.has_pro_access() then raise exception 'pro_required'; end if;
  select timezone into zone from public.booking_links where booking_links.owner_id=v_owner;
  zone:=coalesce(zone,'Europe/Madrid');
  if (input->>'date')::date < (now() at time zone zone)::date then raise exception 'invalid_date'; end if;
  if (input->>'expires_hours')::integer not between 1 and 168 then raise exception 'invalid_deadline'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text,301));
  event_window:=booking_private.slot((input->>'date')::date,input->>'start_time',input->>'end_time',zone);
  if booking_private.has_conflict(v_owner,event_window,r.id) then raise exception 'schedule_conflict'; end if;
  select coalesce(max(version),0)+1 into version_number from public.booking_proposals where request_id=r.id;
  deadline:=least(now()+make_interval(hours=>(input->>'expires_hours')::integer),lower(event_window));
  if deadline<=now() then raise exception 'invalid_date'; end if;
  insert into public.booking_proposals(request_id,version,event_title,venue,city,date,start_time,end_time,timezone,fee,currency,terms,expires_at,hold_until)
  values(r.id,version_number,btrim(input->>'event_title'),btrim(input->>'venue'),btrim(input->>'city'),(input->>'date')::date,input->>'start_time',input->>'end_time',zone,(input->>'fee')::numeric,input->>'currency',coalesce(input->>'terms',''),deadline,case when (input->>'hold')::boolean then deadline end) returning * into p;
  update public.booking_requests set latest_proposal_id=p.id,state='proposed',updated_at=now() where id=r.id;
 else raise exception 'invalid_action'; end if;
 insert into booking_private.email_outbox(request_id,payload) values(r.id,jsonb_build_object('kind','update'));
 return booking_private.snapshot(r.id);
end; $$;
revoke all on function booking_private.dj_action(text,jsonb) from public,anon;
grant execute on function booking_private.dj_action(text,jsonb) to authenticated;
create function public.booking_dj_action(action text,input jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select booking_private.dj_action(action,input); $$;

create function public.booking_guest_action(action text,input jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.booking_requests; p public.booking_proposals; config public.booking_links; v_session_id uuid; event_window tstzrange;
begin
 if action='request' then
  select * into config from public.booking_links where slug=input->>'slug' and enabled;
  if config.owner_id is null or not exists(select 1 from public.community_profiles where user_id=config.owner_id and is_visible) then raise exception 'link_unavailable'; end if;
  if (input->>'date')::date<(now() at time zone config.timezone)::date then raise exception 'invalid_date'; end if;
  select * into r from public.booking_requests where submission_key=(input->>'submission_key')::uuid and owner_id=config.owner_id and promoter_email=lower(btrim(input->>'promoter_email'));
  if r.id is not null then return to_jsonb(r); end if;
  insert into public.booking_requests(submission_key,owner_id,promoter_name,promoter_email,event_title,venue,city,date,start_time,end_time,budget,currency,timezone,language)
  values((input->>'submission_key')::uuid,config.owner_id,btrim(input->>'promoter_name'),lower(btrim(input->>'promoter_email')),btrim(input->>'event_title'),btrim(input->>'venue'),btrim(input->>'city'),(input->>'date')::date,input->>'start_time',input->>'end_time',(input->>'budget')::numeric,input->>'currency',config.timezone,input->>'language') returning * into r;
  if length(btrim(coalesce(input->>'body','')))>0 then insert into public.booking_messages(request_id,sender,body) values(r.id,'promoter',btrim(input->>'body')); end if;
  insert into booking_private.guest_access(token_hash,request_id,expires_at) values(input->>'token_hash',r.id,now()+interval '24 hours');
  insert into booking_private.email_outbox(request_id,payload) values(r.id,jsonb_build_object('kind','verify','token',input->>'token'));
  return to_jsonb(r);
 end if;
 select b.* into r from public.booking_requests b join booking_private.guest_access a on a.request_id=b.id where a.token_hash=input->>'token_hash' and a.expires_at>now() and b.id=(input->>'id')::uuid for update of b;
 if r.id is null then raise exception 'access_expired'; end if;
 if action='verify' then
  if r.state='unverified' then
   update public.booking_requests set state='new',verified_at=now(),updated_at=now() where id=r.id;
   perform booking_private.notify(r.id,'booking_request');
   update booking_private.guest_access set expires_at=now()+interval '30 days' where token_hash=input->>'token_hash';
  end if;
 elsif r.state='unverified' then raise exception 'email_unverified';
 elsif action='read' then null;
 elsif action='message' or action='changes' then
  if r.state in ('declined','closed') then raise exception 'request_closed'; end if;
  if input->>'body' is null or length(btrim(input->>'body')) not between 1 and 3000 then raise exception 'invalid_message'; end if;
  insert into public.booking_messages(request_id,sender,body) values(r.id,'promoter',btrim(input->>'body'));
  update public.booking_requests set state=case when action='changes' and state='proposed' then 'negotiating' else state end,updated_at=now() where id=r.id;
  perform booking_private.notify(r.id,'booking_message');
 elsif action='accept' then
  if r.state='accepted' and r.latest_proposal_id=(input->>'proposal_id')::uuid then return booking_private.snapshot(r.id); end if;
  if r.state<>'proposed' or r.latest_proposal_id is distinct from (input->>'proposal_id')::uuid then raise exception 'proposal_changed'; end if;
  select * into p from public.booking_proposals where id=r.latest_proposal_id;
  if p.expires_at<=now() then raise exception 'proposal_expired'; end if;
  perform pg_advisory_xact_lock(hashtextextended(r.owner_id::text,301));
  event_window:=booking_private.slot(p.date,p.start_time,p.end_time,p.timezone);
  if booking_private.has_conflict(r.owner_id,event_window,r.id) then raise exception 'schedule_conflict'; end if;
  update public.booking_requests set state='accepted',updated_at=now() where id=r.id;
  insert into public.sessions(user_id,date,title,venue,start_time,end_time,color,is_collective,djs,earning_type,earning_amount,currency,recurrence_type,status,booking_timezone)
  values(r.owner_id,p.date,p.event_title,p.venue,p.start_time,p.end_time,'#6554df',false,'{}',case when p.fee=0 then 'free' else 'fixed' end,p.fee,case p.currency when 'EUR' then '€' when 'USD' then '$' else '£' end,'none','confirmed',p.timezone) returning id into v_session_id;
  update public.booking_requests set session_id=v_session_id where id=r.id;
  perform booking_private.notify(r.id,'booking_confirmed');
 elsif action='decline' then
  if r.state not in ('new','negotiating','proposed') then raise exception 'request_closed'; end if;
  update public.booking_requests set state='declined',updated_at=now() where id=r.id;
  perform booking_private.notify(r.id,'booking_message');
 else raise exception 'invalid_action'; end if;
 return booking_private.snapshot(r.id);
end; $$;

-- Session creation and edits respect holds, including direct API writes and series.
create function booking_private.held_overlap(dj uuid, event_date date, starts text, ends text, event_zone text)
returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from public.booking_requests r join public.booking_proposals p on p.id=r.latest_proposal_id
 where r.owner_id=dj and r.state='proposed' and p.hold_until>now() and p.expires_at>now()
 and booking_private.slot(p.date,p.start_time,p.end_time,p.timezone) && booking_private.slot(event_date,starts,ends,event_zone));
$$;
create function booking_private.respect_holds()
returns trigger language plpgsql security definer set search_path='' as $$
declare participant uuid; zone text;
begin
 if new.status='cancelled' then return new; end if;
 zone:=coalesce(new.booking_timezone,(select timezone from public.booking_links where owner_id=new.user_id),'Europe/Madrid');
 -- Lock participants in a stable order, including DJs who accepted a collaboration.
 for participant in select dj from (select new.user_id dj union select dj_id from public.session_collaborators where session_id=new.id and status='accepted') members order by dj loop
  perform pg_advisory_xact_lock(hashtextextended(participant::text,301));
  if booking_private.held_overlap(participant,new.date,new.start_time,new.end_time,zone) then raise exception 'booking_hold_conflict'; end if;
 end loop;
 return new;
end; $$;
create trigger respect_booking_holds before insert or update of date,start_time,end_time,status,booking_timezone on public.sessions for each row execute function booking_private.respect_holds();
create function booking_private.respect_collaborator_holds()
returns trigger language plpgsql security definer set search_path='' as $$
declare s public.sessions;
begin
 if new.status<>'accepted' then return new; end if;
 select * into s from public.sessions where id=new.session_id;
 if s.status='cancelled' then return new; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.dj_id::text,301));
 if booking_private.held_overlap(new.dj_id,s.date,s.start_time,s.end_time,coalesce(s.booking_timezone,(select timezone from public.booking_links where owner_id=s.user_id),'Europe/Madrid')) then raise exception 'booking_hold_conflict'; end if;
 return new;
end; $$;
create trigger respect_collaborator_booking_holds before insert or update of status on public.session_collaborators for each row execute function booking_private.respect_collaborator_holds();
revoke all on all functions in schema booking_private from public,anon,authenticated;
grant execute on function booking_private.dj_action(text,jsonb) to authenticated;
grant execute on all functions in schema booking_private to service_role;
revoke all on function public.booking_guest_action(text,jsonb),public.booking_rate_limit(text,integer) from public,anon,authenticated;
grant execute on function public.booking_guest_action(text,jsonb),public.booking_rate_limit(text,integer) to service_role;
revoke all on function public.booking_dj_action(text,jsonb) from public,anon;
grant execute on function public.booking_dj_action(text,jsonb) to authenticated;

create function public.booking_email_claim(request_id uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 update booking_private.email_outbox set state='sending',attempts=attempts+1,available_at=now()+interval '2 minutes' where id=(select id from booking_private.email_outbox e where (booking_email_claim.request_id is null or e.request_id=booking_email_claim.request_id) and e.state in ('pending','failed','sending') and e.available_at<=now() and e.attempts<8 order by created_at limit 1 for update skip locked) returning to_jsonb(email_outbox) into result;
 return result;
end; $$;
create function public.booking_email_finish(email_id uuid, delivered boolean)
returns void language plpgsql security invoker set search_path='' as $$
begin
 update booking_private.email_outbox set state=case when delivered then 'sent' else 'failed' end, sent_at=case when delivered then now() end, available_at=now()+interval '5 minutes', payload=case when delivered then '{}'::jsonb else payload end where id=email_id and state='sending';
end; $$;
revoke all on function public.booking_email_claim(uuid),public.booking_email_finish(uuid,boolean) from public,anon,authenticated;
grant execute on function public.booking_email_claim(uuid),public.booking_email_finish(uuid,boolean) to service_role;
create function public.booking_set_ready(ready boolean)
returns void language sql security invoker set search_path='' as $$ update booking_private.runtime_config set ready=booking_set_ready.ready where id; $$;
create function public.booking_cached_access(owner_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select to_jsonb(a) from billing_private.subscription_access a where user_id=owner_id; $$;
create function public.booking_delivery_token(email_id uuid,new_token text,new_hash text)
returns text language plpgsql security invoker set search_path='' as $$
declare item booking_private.email_outbox;
begin
 select * into item from booking_private.email_outbox where id=email_id and state='sending' for update;
 if item.id is null then raise exception 'delivery_not_found'; end if;
 if item.payload->>'token' is not null then return item.payload->>'token'; end if;
 insert into booking_private.guest_access(token_hash,request_id,expires_at) values(new_hash,item.request_id,now()+interval '30 days');
 update booking_private.email_outbox set payload=payload||jsonb_build_object('token',new_token) where id=item.id;
 return new_token;
end; $$;
revoke all on function public.booking_set_ready(boolean),public.booking_cached_access(uuid),public.booking_delivery_token(uuid,text,text) from public,anon,authenticated;
grant execute on function public.booking_set_ready(boolean),public.booking_cached_access(uuid),public.booking_delivery_token(uuid,text,text) to service_role;

-- An identical submission retry can acknowledge a previously delivered email.
create function public.booking_email_sent(request_id uuid)
returns boolean language sql security invoker set search_path='' as $$
 select exists(select 1 from booking_private.email_outbox e where e.request_id=booking_email_sent.request_id and e.state='sent');
$$;
revoke all on function public.booking_email_sent(uuid) from public,anon,authenticated;
grant execute on function public.booking_email_sent(uuid) to service_role;
