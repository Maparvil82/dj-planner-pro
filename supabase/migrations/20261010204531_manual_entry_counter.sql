-- Manual admissions complement QR counts without storing attendees' identities.
create table public.event_manual_entries (
 session_id uuid not null references public.sessions(id) on delete cascade,
 request_id uuid not null,
 scanned_at timestamptz not null default clock_timestamp(),
 primary key(session_id,request_id)
);
alter table public.event_manual_entries enable row level security;
revoke all on public.event_manual_entries from public,anon,authenticated;
grant select on public.event_manual_entries to authenticated;
create policy organizer_manual_entries on public.event_manual_entries for select to authenticated
 using(exists(select 1 from public.sessions s where s.id=session_id and s.user_id=(select auth.uid())));
create trigger account_write_guard before insert or update on public.event_manual_entries
 for each row execute function account_private.write_guard();
create function ticketing_private.count_manual_entry(p_session uuid,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare at_time timestamptz;
begin
 perform 1 from public.sessions where id=p_session and user_id=auth.uid()
 and status is distinct from 'cancelled' for update;
 if not found or auth.uid() is null or not account_private.active_user(auth.uid()) then
  raise exception 'tickets.unavailable';
 end if;
 if p_request is null then raise exception 'tickets.unavailable'; end if;
 insert into public.event_manual_entries(session_id,request_id) values(p_session,p_request)
 on conflict do nothing returning scanned_at into at_time;
 if at_time is null then
  select scanned_at into at_time from public.event_manual_entries where session_id=p_session and request_id=p_request;
 end if;
 return jsonb_build_object('status','accepted','checked_in_at',at_time,
 'count',(select count(*) from public.event_entry_scans where session_id=p_session)+(select count(*) from public.event_manual_entries where session_id=p_session));
end $$;
create function public.count_manual_event_entry(p_session uuid,p_request uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select ticketing_private.count_manual_entry(p_session,p_request)
$$;
revoke all on function ticketing_private.count_manual_entry(uuid,uuid),public.count_manual_event_entry(uuid,uuid) from public,anon;
grant execute on function ticketing_private.count_manual_entry(uuid,uuid),public.count_manual_event_entry(uuid,uuid) to authenticated;
create or replace function public.event_entry_count(p_session uuid)
returns bigint language sql stable security invoker set search_path='' as $$
 select (select count(*) from public.event_entry_scans where session_id=p_session)+(select count(*) from public.event_manual_entries where session_id=p_session)
$$;
create or replace function ticketing_private.count_entry(p_session uuid,p_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare at_time timestamptz; inserted boolean;
begin
 -- Serializes admission against concurrent scans, cancellation and deletion.
 perform 1 from public.sessions where id=p_session and user_id=auth.uid()
 and status is distinct from 'cancelled' for update;
 if not found or auth.uid() is null or not account_private.active_user(auth.uid()) then
  raise exception 'tickets.unavailable';
 end if;
 if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then raise exception 'tickets.invalidQr'; end if;
 insert into public.event_entry_scans(session_id,code_hash) values(p_session,p_hash)
 on conflict do nothing returning scanned_at into at_time;
 inserted:=found;
 if not inserted then
  select scanned_at into at_time from public.event_entry_scans where session_id=p_session and code_hash=p_hash;
 end if;
 return jsonb_build_object('status',case when inserted then 'accepted' else 'already_used' end,
 'checked_in_at',at_time,'count',(select count(*) from public.event_entry_scans where session_id=p_session)+(select count(*) from public.event_manual_entries where session_id=p_session));
end $$;
