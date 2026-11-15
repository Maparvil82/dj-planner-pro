-- Additive feature: written session notes and existing session writes are unchanged.
create schema if not exists voice_private;
revoke all on schema voice_private from public,anon,authenticated;
grant usage on schema voice_private to authenticated;
create table public.session_voice_notes (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
 session_id uuid not null references public.sessions(id) on delete cascade,
 venue_id uuid references public.venues(id) on delete cascade,
 title text not null default '' check(char_length(title)<=120),
 duration_ms integer not null check(duration_ms between 1 and 20500),
 audio_path text generated always as (user_id::text || '/' || id::text || '.m4a') stored,
 ready boolean not null default false,
 remind_next boolean not null default true,
 resolved_at timestamptz,
 created_at timestamptz not null default now()
);
create index session_voice_notes_session on public.session_voice_notes(user_id,session_id);
create index session_voice_notes_pending on public.session_voice_notes(user_id,venue_id) where ready and remind_next and resolved_at is null;
alter table public.session_voice_notes enable row level security;
grant select,insert,update,delete on public.session_voice_notes to authenticated;
create policy voice_owner_read on public.session_voice_notes for select to authenticated using(user_id=auth.uid());
create policy voice_owner_insert on public.session_voice_notes for insert to authenticated with check(user_id=auth.uid() and billing_private.has_pro_access());
create policy voice_owner_update on public.session_voice_notes for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and billing_private.has_pro_access());
create policy voice_owner_delete on public.session_voice_notes for delete to authenticated using(user_id=auth.uid());

create function voice_private.validate_note() returns trigger language plpgsql security invoker set search_path='' as $$
declare source public.sessions;
begin
 select * into source from public.sessions where id=new.session_id and user_id=auth.uid();
 if source.id is null or new.user_id is distinct from auth.uid() then raise exception 'VOICE_OWNER_REQUIRED' using errcode='42501'; end if;
 if tg_op='UPDATE' and (new.id<>old.id or new.session_id<>old.session_id or new.user_id<>old.user_id or new.created_at<>old.created_at or new.venue_id is distinct from old.venue_id) then raise exception 'VOICE_SOURCE_IMMUTABLE'; end if;
 if tg_op='INSERT' then new.venue_id:=source.venue_id; end if;
 if new.ready and not exists(select 1 from storage.objects where bucket_id='session-voice-notes' and name=new.user_id::text || '/' || new.id::text || '.m4a') then raise exception 'VOICE_UPLOAD_REQUIRED'; end if;
 return new;
end $$;
revoke all on function voice_private.validate_note() from public,anon,authenticated;
create trigger voice_note_validation before insert or update on public.session_voice_notes for each row execute function voice_private.validate_note();
create trigger voice_note_account_guard before insert or update on public.session_voice_notes for each row execute function account_private.write_guard();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('session-voice-notes','session-voice-notes',false,204800,array['audio/mp4','audio/x-m4a']);
create policy voice_audio_read on storage.objects for select to authenticated using(bucket_id='session-voice-notes' and exists(select 1 from public.session_voice_notes n where n.user_id=auth.uid() and n.audio_path=name));
create policy voice_audio_upload on storage.objects for insert to authenticated with check(bucket_id='session-voice-notes' and billing_private.has_pro_access() and exists(select 1 from public.session_voice_notes n where n.user_id=auth.uid() and n.audio_path=name and not n.ready));
create policy voice_audio_delete on storage.objects for delete to authenticated using(bucket_id='session-voice-notes' and split_part(name,'/',1)=auth.uid()::text);

create table public.session_voice_reminders (
 note_id uuid not null references public.session_voice_notes(id) on delete cascade,
 session_id uuid not null references public.sessions(id) on delete cascade,
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(note_id,session_id)
);
alter table public.session_voice_reminders enable row level security;
grant select,insert,delete on public.session_voice_reminders to authenticated;
create policy voice_reminder_read on public.session_voice_reminders for select to authenticated using(user_id=auth.uid());
create policy voice_reminder_delete on public.session_voice_reminders for delete to authenticated using(user_id=auth.uid());
create policy voice_reminder_insert on public.session_voice_reminders for insert to authenticated with check(user_id=auth.uid() and billing_private.has_pro_access() and exists(
 select 1 from public.session_voice_notes n join public.sessions s on s.id=session_voice_reminders.session_id
 where n.id=note_id and n.user_id=auth.uid() and s.user_id=auth.uid() and n.venue_id=s.venue_id and n.session_id<>s.id
 and n.ready and n.remind_next and n.resolved_at is null and s.status is distinct from 'cancelled'
));
create trigger voice_reminder_account_guard before insert or update on public.session_voice_reminders for each row execute function account_private.write_guard();

-- Invoker functions inherit owner RLS. No privileged public RPC is introduced.
create function public.pending_voice_notes(target_session uuid) returns setof public.session_voice_notes
language sql stable security invoker set search_path='' as $$
 select n.* from public.session_voice_notes n
 join public.sessions target on target.id=target_session
 join public.sessions source on source.id=n.session_id
 where billing_private.has_pro_access() and target.user_id=auth.uid() and n.user_id=auth.uid()
 and n.venue_id=target.venue_id and n.session_id<>target.id and source.date<=target.date
 and n.ready and n.remind_next and n.resolved_at is null and target.status is distinct from 'cancelled'
 order by n.created_at desc limit 50;
$$;
create function public.voice_reminder_schedule() returns table(note_id uuid,session_id uuid,title text,venue text,date date,start_time time,booking_timezone text)
language sql stable security invoker set search_path='' as $$
 select n.id,s.id,n.title,s.venue,s.date,s.start_time::time,s.booking_timezone
 from public.session_voice_reminders r join public.session_voice_notes n on n.id=r.note_id join public.sessions s on s.id=r.session_id
 where r.user_id=auth.uid() and s.user_id=auth.uid() and n.user_id=auth.uid() and billing_private.has_pro_access()
 and n.venue_id=s.venue_id and n.ready and n.remind_next and n.resolved_at is null and s.status is distinct from 'cancelled' and s.date>=current_date
 order by s.date,s.start_time limit 50;
$$;
revoke all on function public.pending_voice_notes(uuid),public.voice_reminder_schedule() from public,anon;
grant execute on function public.pending_voice_notes(uuid),public.voice_reminder_schedule() to authenticated;

-- Integrate voice files with the existing shared 100 MB budget, account deletion,
-- and unused-file cleanup without replacing unrelated logic in those functions.
do $$ declare f record; definition text; begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='storage_private' and p.proname in ('budget_guard','cleanup'))
 or (n.nspname='account_private' and p.prosrc like '%expense-receipts%') loop
  definition:=pg_get_functiondef(f.oid);
  definition:=replace(definition,'''avatars'',''sessions'',''venues'',''vault'',''expense-receipts''','''avatars'',''sessions'',''venues'',''vault'',''expense-receipts'',''session-voice-notes''');
  definition:=replace(definition,'''avatars'',''venues'',''sessions'',''vault'',''expense-receipts''','''avatars'',''venues'',''sessions'',''vault'',''expense-receipts'',''session-voice-notes''');
  execute definition;
 end loop;
end $$;
create function voice_private.track_audio() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then
  delete from storage_private.references where source_kind='session_voice_notes' and source_id=old.id;
  return old;
 end if;
 insert into storage_private.references(source_kind,source_id,bucket_id,name)
 values('session_voice_notes',new.id,'session-voice-notes',new.audio_path) on conflict do nothing;
 return new;
end $$;
revoke all on function voice_private.track_audio() from public,anon,authenticated;
create trigger voice_audio_inventory after insert or delete on public.session_voice_notes for each row execute function voice_private.track_audio();
create trigger voice_audio_reference_guard before update on public.session_voice_notes for each row execute function storage_private.reference_guard();
