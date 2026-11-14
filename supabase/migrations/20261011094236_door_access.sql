-- Capability-based door access. No staff Auth accounts and no public table access.
create schema door_private;
revoke all on schema door_private from public,anon,authenticated;
grant usage on schema door_private to anon,authenticated;
create table door_private.invites (
 id uuid primary key,
 session_id uuid not null references public.sessions(id) on delete cascade,
 timezone text not null,
 label text not null check(length(btrim(label)) between 1 and 80),
 token_hash text not null check(token_hash ~ '^[0-9a-f]{64}$'),
 device_hash text check(device_hash ~ '^[0-9a-f]{64}$'),
 claimed_at timestamptz,
 revoked_at timestamptz,
 created_at timestamptz not null default clock_timestamp(),
 last_seen_at timestamptz,
 window_at timestamptz not null default clock_timestamp(),
 requests integer not null default 0
);
create index door_invites_session on door_private.invites(session_id);
alter table door_private.invites enable row level security;
revoke all on door_private.invites from public,anon,authenticated;
create table door_private.operations (
 id uuid primary key,
 session_id uuid not null references public.sessions(id) on delete cascade,
 invite_id uuid not null references door_private.invites(id) on delete cascade,
 kind text not null check(kind in ('manual','guest')),
 guest_id uuid,
 quantity integer not null,
 created_at timestamptz not null default clock_timestamp()
);
create index door_operations_session on door_private.operations(session_id);
create index door_operations_invite on door_private.operations(invite_id);
alter table door_private.operations enable row level security;
revoke all on door_private.operations from public,anon,authenticated;
alter table public.event_entry_scans add column door_id uuid references door_private.invites(id) on delete set null;
create index event_entry_scans_door on public.event_entry_scans(door_id) where door_id is not null;

create function door_private.ends_at(s public.sessions) returns timestamptz
language sql stable set search_path='' as $$
 select (s.date::date + coalesce(nullif(s.end_time,''),'23:59')::time
 + case when coalesce(nullif(s.end_time,''),'23:59')::time <= coalesce(nullif(s.start_time,''),'00:00')::time then interval '1 day' else interval '0 day' end)
 at time zone coalesce(nullif(s.booking_timezone,''),'UTC')
$$;

-- Doors may open up to two hours before the set; later dates remain read-only.
create function door_private.opens_at(s public.sessions) returns timestamptz
language sql stable set search_path='' as $$
 select ((s.date::date + coalesce(nullif(s.start_time,''),'00:00')::time) at time zone coalesce(nullif(s.booking_timezone,''),'UTC')) - interval '2 hours'
$$;

-- Every operation locks the session before the invitation, including revocation.
-- Owner deletion is serialized using the same advisory lock as account deletion.
create function door_private.check_access(p_id uuid,p_secret text,p_claim boolean default false)
returns door_private.invites language plpgsql security definer set search_path='' as $$
declare invitation door_private.invites; s public.sessions;
begin
 if p_id is null or p_secret is null or p_secret !~ '^[0-9a-f]{64}$' then raise exception 'door.unavailable'; end if;
 select * into invitation from door_private.invites where id=p_id;
 if not found then raise exception 'door.unavailable'; end if;
 select * into s from public.sessions where id=invitation.session_id for update;
 if not found or s.status='cancelled' then raise exception 'door.unavailable'; end if;
 s.booking_timezone:=coalesce(nullif(s.booking_timezone,''),invitation.timezone);
 perform pg_advisory_xact_lock(hashtextextended(s.user_id::text,8102));
 if not account_private.active_user(s.user_id) or clock_timestamp() >= door_private.ends_at(s) then raise exception 'door.unavailable'; end if;
 select * into invitation from door_private.invites where id=p_id for update;
 if invitation.revoked_at is not null then raise exception 'door.unavailable'; end if;
 if p_claim then
  if invitation.token_hash <> encode(sha256(convert_to(p_secret,'UTF8')),'hex') then raise exception 'door.unavailable'; end if;
 else
  if invitation.device_hash is null or invitation.device_hash <> encode(sha256(convert_to(p_secret,'UTF8')),'hex') then raise exception 'door.unavailable'; end if;
 end if;
 -- A successful capability must still respect an operational request budget.
 if invitation.window_at < clock_timestamp()-interval '1 minute' then
  update door_private.invites set window_at=clock_timestamp(),requests=1,last_seen_at=clock_timestamp() where id=p_id;
 elsif invitation.requests>=180 then raise exception 'door.rateLimit';
 else update door_private.invites set requests=requests+1,last_seen_at=clock_timestamp() where id=p_id;
 end if;
 return invitation;
end $$;

create function door_private.manage(p_session uuid,p_action text,p_id uuid,p_label text,p_hash text,p_zone text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.sessions; invitation door_private.invites;
begin
 select * into s from public.sessions where id=p_session and user_id=auth.uid() for update;
 if not found or auth.uid() is null then raise exception 'door.unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(s.user_id::text,8102));
 if not account_private.active_user(s.user_id) then raise exception 'door.unavailable'; end if;
 if p_action='create' then
  s.booking_timezone:=coalesce(nullif(s.booking_timezone,''),nullif(p_zone,''),'UTC');
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=s.booking_timezone) then raise exception 'door.invalid'; end if;
  if s.status='cancelled' or clock_timestamp() >= door_private.ends_at(s) then raise exception 'door.unavailable'; end if;
  if p_id is null or p_label is null or length(btrim(p_label)) not between 1 and 80 or p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then raise exception 'door.invalid'; end if;
  select * into invitation from door_private.invites where id=p_id;
  if found then
   if invitation.session_id<>p_session or invitation.token_hash<>p_hash or invitation.label<>btrim(p_label) then raise exception 'door.invalid'; end if;
  else
   if (select count(*) from door_private.invites where session_id=p_session and revoked_at is null)>=20 then raise exception 'door.limit'; end if;
   insert into door_private.invites(id,session_id,label,token_hash,timezone) values(p_id,p_session,btrim(p_label),p_hash,s.booking_timezone);
  end if;
 elsif p_action='revoke' then
  update door_private.invites set revoked_at=coalesce(revoked_at,clock_timestamp()) where id=p_id and session_id=p_session;
  if not found then raise exception 'door.unavailable'; end if;
 elsif p_action<>'list' or p_action is null then raise exception 'door.invalid';
 end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'label',i.label,'claimed_at',i.claimed_at,'revoked_at',i.revoked_at,'last_seen_at',i.last_seen_at,
  'qr_count',(select count(*) from public.event_entry_scans e where e.door_id=i.id),
  'manual_count',(select count(*) from door_private.operations o where o.invite_id=i.id and o.kind='manual'),
  'guest_count',coalesce((select sum(quantity) from door_private.operations o where o.invite_id=i.id and o.kind='guest'),0)) order by i.created_at)
  from door_private.invites i where i.session_id=p_session),'[]'::jsonb);
end $$;
create function door_private.claim(p_id uuid,p_token text,p_device text) returns uuid
language plpgsql security definer set search_path='' as $$
declare invitation door_private.invites; digest text;
begin
 if p_device is null or p_device !~ '^[0-9a-f]{64}$' then raise exception 'door.invalid'; end if;
 invitation:=door_private.check_access(p_id,p_token,true);
 digest:=encode(sha256(convert_to(p_device,'UTF8')),'hex');
 if invitation.device_hash is not null and invitation.device_hash<>digest then raise exception 'door.alreadyClaimed'; end if;
 update door_private.invites set device_hash=digest,claimed_at=coalesce(claimed_at,clock_timestamp()) where id=p_id;
 return invitation.session_id;
end $$;
create function door_private.state(p_id uuid,p_device text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare invitation door_private.invites; s public.sessions; g jsonb;
begin
 invitation:=door_private.check_access(p_id,p_device);
 select * into s from public.sessions where id=invitation.session_id;
 s.booking_timezone:=coalesce(nullif(s.booking_timezone,''),invitation.timezone);
 select coalesce(jsonb_agg(r order by lower(r.full_name),r.id),'[]'::jsonb) into g from (
  select g.id,g.full_name,g.companions,count(e.id) filter(where e.state<>'cancelled') as total,count(e.id) filter(where e.state='used') as admitted
  from public.event_guest_groups g left join public.event_tickets e on e.guest_id=g.id where g.session_id=s.id group by g.id
 ) r;
 return jsonb_build_object('session_id',s.id,'title',s.title,'venue',s.venue,'date',s.date,'start_time',s.start_time,'end_time',s.end_time,'ends_at',door_private.ends_at(s),'opens_at',door_private.opens_at(s),'label',invitation.label,
  'entries',(select count(*) from public.event_entry_scans where session_id=s.id)+(select count(*) from public.event_manual_entries where session_id=s.id),'guests',g);
end $$;
create function door_private.scan(p_id uuid,p_device text,p_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare invitation door_private.invites; stamp timestamptz; added boolean;
begin
 invitation:=door_private.check_access(p_id,p_device);
 if clock_timestamp() < (select ((s.date::date + coalesce(nullif(s.start_time,''),'00:00')::time) at time zone coalesce(nullif(s.booking_timezone,''),invitation.timezone)) - interval '2 hours' from public.sessions s where s.id=invitation.session_id) then raise exception 'door.notOpen'; end if;
 if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then raise exception 'tickets.invalidQr'; end if;
 insert into public.event_entry_scans(session_id,code_hash,door_id) values(invitation.session_id,p_hash,p_id)
 on conflict do nothing returning scanned_at into stamp;
 added:=found;
 if not added then select scanned_at into stamp from public.event_entry_scans where session_id=invitation.session_id and code_hash=p_hash; end if;
 return jsonb_build_object('status',case when added then 'accepted' else 'already_used' end,'checked_in_at',stamp,
  'count',(select count(*) from public.event_entry_scans where session_id=invitation.session_id)+(select count(*) from public.event_manual_entries where session_id=invitation.session_id));
end $$;
create function door_private.admit(p_id uuid,p_device text,p_request uuid,p_guest uuid,p_quantity integer) returns void
language plpgsql security definer set search_path='' as $$
declare invitation door_private.invites; prior door_private.operations; available integer;
begin
 invitation:=door_private.check_access(p_id,p_device);
 if clock_timestamp() < (select ((s.date::date + coalesce(nullif(s.start_time,''),'00:00')::time) at time zone coalesce(nullif(s.booking_timezone,''),invitation.timezone)) - interval '2 hours' from public.sessions s where s.id=invitation.session_id) then raise exception 'door.notOpen'; end if;
 if p_request is null or p_quantity is null or p_quantity not between 1 and 100 then raise exception 'door.invalid'; end if;
 select * into prior from door_private.operations where id=p_request;
 if found then
  if prior.invite_id<>p_id or prior.guest_id is distinct from p_guest or prior.quantity<>p_quantity then raise exception 'door.invalid'; end if;
  return;
 end if;
 if p_guest is null then
  if p_quantity<>1 then raise exception 'door.invalid'; end if;
  -- Namespaced key cannot collide with an organizer's manual request UUID.
  if exists(select 1 from public.event_manual_entries where session_id=invitation.session_id and request_id=p_request) then raise exception 'door.invalid'; end if;
  insert into public.event_manual_entries(session_id,request_id) values(invitation.session_id,p_request);
 else
  if not exists(select 1 from public.event_guest_groups where id=p_guest and session_id=invitation.session_id) then raise exception 'door.unavailable'; end if;
  select count(*) into available from public.event_tickets where guest_id=p_guest and state='issued';
  if p_quantity>available then raise exception 'guests.changed'; end if;
  update public.event_tickets set state='used',checked_in_at=clock_timestamp() where id in (
   select id from public.event_tickets where guest_id=p_guest and state='issued' order by ordinal limit p_quantity
  );
 end if;
 insert into door_private.operations(id,session_id,invite_id,kind,guest_id,quantity)
 values(p_request,invitation.session_id,p_id,case when p_guest is null then 'manual' else 'guest' end,p_guest,p_quantity);
end $$;

create function public.door_manage(p_session uuid,p_action text,p_id uuid default null,p_label text default null,p_hash text default null,p_zone text default null) returns jsonb language sql security invoker set search_path='' as $$select door_private.manage(p_session,p_action,p_id,p_label,p_hash,p_zone)$$;
create function public.door_claim(p_id uuid,p_token text,p_device text) returns uuid language sql security invoker set search_path='' as $$select door_private.claim(p_id,p_token,p_device)$$;
create function public.door_state(p_id uuid,p_device text) returns jsonb language sql security invoker set search_path='' as $$select door_private.state(p_id,p_device)$$;
create function public.door_scan(p_id uuid,p_device text,p_hash text) returns jsonb language sql security invoker set search_path='' as $$select door_private.scan(p_id,p_device,p_hash)$$;
create function public.door_admit(p_id uuid,p_device text,p_request uuid,p_guest uuid default null,p_quantity integer default 1) returns void language sql security invoker set search_path='' as $$select door_private.admit(p_id,p_device,p_request,p_guest,p_quantity)$$;
revoke all on all functions in schema door_private from public,anon,authenticated;
revoke all on function public.door_manage(uuid,text,uuid,text,text,text),public.door_claim(uuid,text,text),public.door_state(uuid,text),public.door_scan(uuid,text,text),public.door_admit(uuid,text,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function door_private.manage(uuid,text,uuid,text,text,text),public.door_manage(uuid,text,uuid,text,text,text) to authenticated;
-- Only these capability-checking entry points are callable without an account.
grant execute on function door_private.claim(uuid,text,text),door_private.state(uuid,text),door_private.scan(uuid,text,text),door_private.admit(uuid,text,uuid,uuid,integer),public.door_claim(uuid,text,text),public.door_state(uuid,text),public.door_scan(uuid,text,text),public.door_admit(uuid,text,uuid,uuid,integer) to anon,authenticated;
