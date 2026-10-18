-- File deletion uses the Storage API. SQL only coordinates and verifies it.
create schema account_private;
revoke all on schema account_private from public,anon,authenticated;
grant usage on schema account_private to authenticated,service_role;
create table account_private.deletions (
 receipt uuid primary key default gen_random_uuid(),
 user_id uuid unique, started_at timestamptz not null default now(),
 completed_at timestamptz, expires_at timestamptz
);
alter table account_private.deletions enable row level security;
revoke all on account_private.deletions from public,anon,authenticated;

alter table public.user_tags drop constraint user_tags_user_id_fkey;
alter table public.user_tags add constraint user_tags_user_id_fkey foreign key(user_id) references auth.users(id) on delete cascade;
alter table public.sessions drop constraint sessions_parent_session_id_fkey;
alter table public.sessions add constraint sessions_parent_session_id_fkey foreign key(parent_session_id) references public.sessions(id) on delete set null;

create function account_private.active_user(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users where id=target)
 and not exists(select 1 from account_private.deletions where user_id=target and completed_at is null);
$$;
-- Serialize writes against the start/finalization of deletion. This also rejects
-- still-valid access tokens after the Auth user has been deleted.
create function account_private.write_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare viewer uuid:=auth.uid();
begin
 if viewer is not null then
  perform pg_advisory_xact_lock(hashtextextended(viewer::text,8102));
  if not account_private.active_user(viewer) then raise exception 'ACCOUNT_DELETION_PENDING' using errcode='42501'; end if;
 end if;
 return new;
end $$;
do $$ declare t record; begin
 for t in select tablename from pg_tables where schemaname='public' loop
  execute format('create trigger account_write_guard before insert or update on public.%I for each row execute function account_private.write_guard()',t.tablename);
 end loop;
end $$;
create trigger account_storage_write_guard before insert or update on storage.objects for each row execute function account_private.write_guard();

create function account_private.pending() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from account_private.deletions where user_id=auth.uid() and completed_at is null);
$$;
create function public.account_deletion_pending() returns boolean language sql security invoker set search_path='' as $$ select account_private.pending(); $$;
revoke all on function public.account_deletion_pending() from public,anon;
grant execute on function public.account_deletion_pending() to authenticated;

-- Called only by the authenticated Edge Function with a verified Auth user ID.
create function account_private.work(action text,target uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job account_private.deletions;
begin
 if action='receipt' then
  select * into job from account_private.deletions where receipt=target and completed_at is not null and expires_at>now();
  return jsonb_build_object('complete',found);
 end if;
 if action not in ('begin','page') then raise exception 'Invalid deletion action'; end if;
 perform pg_advisory_xact_lock(hashtextextended(target::text,8102));
 if not exists(select 1 from auth.users where id=target) then raise exception 'Account unavailable' using errcode='42501'; end if;
 if action='begin' then
  delete from account_private.deletions where completed_at is not null and expires_at<now();
  insert into account_private.deletions(user_id) values(target) on conflict(user_id) do nothing;
 end if;
 select * into job from account_private.deletions where user_id=target and completed_at is null;
 if not found then raise exception 'Deletion not started'; end if;
 return jsonb_build_object('receipt',job.receipt,'objects',coalesce((select jsonb_agg(to_jsonb(o)) from (
  select bucket_id,name from storage.objects
  where owner_id=target::text or (bucket_id in ('avatars','venues','sessions','vault','expense-receipts') and split_part(name,'/',1)=target::text)
  order by bucket_id,name limit 100
 ) o),'[]'::jsonb));
end $$;
create function public.account_deletion_work(action text,target uuid) returns jsonb
language sql security invoker set search_path='' as $$ select account_private.work(action,target); $$;
revoke all on function public.account_deletion_work(text,uuid) from public,anon,authenticated;
grant execute on function public.account_deletion_work(text,uuid) to service_role;

-- Auth Admin performs the final hard delete; its cascades are one transaction.
-- If any file or cascade fails, the account and receipt are not finalized.
create function account_private.finalize_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(old.id::text,8102));
 if exists(select 1 from storage.objects where owner_id=old.id::text or (bucket_id in ('avatars','venues','sessions','vault','expense-receipts') and split_part(name,'/',1)=old.id::text)) then
  raise exception 'ACCOUNT_FILES_REMAIN' using errcode='23503';
 end if;
 update community_private.reports set snapshot=jsonb_build_object('deleted_account',true) where author_id=old.id;
 update community_private.reports set details='' where reporter_id=old.id;
 update account_private.deletions set user_id=null,completed_at=now(),expires_at=now()+interval '1 hour' where user_id=old.id;
 return old;
end $$;
create trigger complete_account_deletion before delete on auth.users for each row execute function account_private.finalize_guard();
-- Disable the obsolete client RPC; old app versions must update to use the
-- checked server flow instead of deleting rows piecemeal.
revoke all on function public.delete_user_data() from public,anon,authenticated;
revoke all on all functions in schema account_private from public,anon,authenticated;
grant execute on function account_private.pending() to authenticated;
grant execute on function account_private.work(text,uuid) to service_role;
