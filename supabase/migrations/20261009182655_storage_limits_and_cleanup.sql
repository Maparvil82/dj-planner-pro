-- Only new uploads are restricted; existing files remain accessible.
update storage.buckets set file_size_limit=1048576,
    allowed_mime_types=array['image/jpeg'] where id in ('avatars','sessions','venues');
update storage.buckets set file_size_limit=614400,
    allowed_mime_types=array['image/jpeg'], public=false where id='expense-receipts';
update storage.buckets set file_size_limit=10485760, public=false,
    allowed_mime_types=array['application/pdf','image/jpeg','image/png','image/webp',
        'text/plain','text/csv','application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'] where id='vault';

alter table public.vault_files add column if not exists path text;

create schema if not exists storage_private;
revoke all on schema storage_private from public,anon,authenticated;
grant usage on schema storage_private to authenticated,service_role;
-- Use Storage's existing (bucket_id, name COLLATE C) index; do not alter its indexes.

create or replace function storage_private.budget_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare viewer uuid:=auth.uid(); incoming bigint; current_bytes bigint;
begin
    if viewer is null or new.bucket_id not in ('avatars','sessions','venues','vault','expense-receipts') then return new; end if;
    if split_part(new.name,'/',1)<>viewer::text then raise exception 'STORAGE_OWNER_REQUIRED' using errcode='42501'; end if;
    perform pg_advisory_xact_lock(hashtextextended(viewer::text,8102));
    incoming:=coalesce((new.metadata->>'size')::bigint,0);
    select coalesce(sum(coalesce((o.metadata->>'size')::bigint,0)),0) into current_bytes
    from storage.objects o where o.name collate "C">=viewer::text||'/' and o.name collate "C"<viewer::text||'0'
      and o.bucket_id in ('avatars','sessions','venues','vault','expense-receipts')
      and o.id is distinct from new.id;
    if incoming<0 or incoming+current_bytes>104857600 then
        raise exception 'STORAGE_QUOTA_EXCEEDED' using errcode='23514';
    end if;
    return new;
end $$;
revoke all on function storage_private.budget_guard() from public,anon,authenticated;
create trigger storage_budget_guard before insert or update on storage.objects
    for each row execute function storage_private.budget_guard();

-- A successful storage deletion must precede deletion of document metadata.
-- Client cleanup uses Storage API, never SQL deletion of storage.objects.

create table storage_private.cleanup_claims (
    bucket_id text not null, name text not null,
    user_id uuid not null references auth.users(id) on delete cascade,
    completed boolean not null default false,
    primary key(bucket_id,name)
);
alter table storage_private.cleanup_claims enable row level security;
revoke all on storage_private.cleanup_claims from public,anon,authenticated;
create index cleanup_claims_user_idx on storage_private.cleanup_claims(user_id);

-- Indexed reference inventory avoids scanning every user's content per cleanup.
create table storage_private.references (
    source_kind text not null, source_id uuid not null,
    bucket_id text not null, name text not null,
    primary key(source_kind,source_id,bucket_id,name)
);
alter table storage_private.references enable row level security;
revoke all on storage_private.references from public,anon,authenticated;
create index storage_reference_object_idx on storage_private.references(bucket_id,name);
create function storage_private.record_references(kind text,record jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare record_id uuid:=coalesce(record->>'id',record->>'user_id')::uuid; item text[];
begin
    delete from storage_private.references r where r.source_kind=kind and r.source_id=record_id;
    for item in select regexp_matches(record::text,
        '/storage/v1/object/(?:public|sign)/(avatars|sessions|venues|vault)/([a-zA-Z0-9_./-]+)', 'g') loop
        insert into storage_private.references values(kind,record_id,item[1],item[2]) on conflict do nothing;
    end loop;
    if kind='expenses' and nullif(record->>'receipt_path','') is not null then
        insert into storage_private.references values(kind,record_id,'expense-receipts',record->>'receipt_path') on conflict do nothing;
    end if;
    if kind='vault_files' and nullif(record->>'path','') is not null then
        insert into storage_private.references values(kind,record_id,'vault',record->>'path') on conflict do nothing;
    end if;
end $$;
create function storage_private.reference_inventory() returns trigger
language plpgsql security definer set search_path='' as $$
begin
    if tg_op='DELETE' then
        delete from storage_private.references r where r.source_kind=tg_table_name
          and r.source_id=coalesce(to_jsonb(old)->>'id',to_jsonb(old)->>'user_id')::uuid;
        return old;
    end if;
    perform storage_private.record_references(tg_table_name,to_jsonb(new));
    return new;
end $$;
revoke all on function storage_private.record_references(text,jsonb) from public,anon,authenticated;
revoke all on function storage_private.reference_inventory() from public,anon,authenticated;
do $$ declare target text; begin
    foreach target in array array['users_profile','community_profiles','sessions','venues','expenses','vault_files'] loop
        execute format('select storage_private.record_references(%L,to_jsonb(t)) from public.%I t',target,target);
        execute format('create trigger storage_reference_inventory after insert or update or delete on public.%I for each row execute function storage_private.reference_inventory()',target);
    end loop;
    perform storage_private.record_references('reports',to_jsonb(r)) from community_private.reports r;
    create trigger storage_evidence_inventory after insert or update or delete on community_private.reports
        for each row execute function storage_private.reference_inventory();
end $$;

create function storage_private.reference_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare payload text:=to_jsonb(new)::text; owner_id text; owners uuid[]:=array[auth.uid()];
begin
    if auth.uid() is null then return new; end if;
    -- Synchronize referencing another DJ's image with that owner's cleanup.
    for owner_id in select distinct m[3] from regexp_matches(payload,
        '/storage/v1/object/(public|sign)/(avatars|sessions|venues|vault)/([0-9a-f-]{36})/', 'g') m order by m[3]
    loop
        perform pg_advisory_xact_lock(hashtextextended(owner_id,8102));
        owners:=array_append(owners,owner_id::uuid);
    end loop;
    if exists(select 1 from storage_private.cleanup_claims c where c.user_id=any(owners) and strpos(payload,c.name)>0) then
        raise exception 'STORAGE_FILE_EXPIRED' using errcode='23514';
    end if;
    return new;
end $$;
revoke all on function storage_private.reference_guard() from public,anon,authenticated;
do $$ declare target text; begin
    foreach target in array array['users_profile','community_profiles','sessions','venues','expenses','vault_files'] loop
        execute format('create trigger storage_reference_guard before insert or update on public.%I for each row execute function storage_private.reference_guard()',target);
    end loop;
end $$;

create function storage_private.cleanup(action text,target uuid,items jsonb default '[]') returns jsonb
language plpgsql security definer set search_path='' as $$
begin
    if not exists(select 1 from auth.users where id=target) then raise exception 'ACCOUNT_REQUIRED'; end if;
    perform pg_advisory_xact_lock(hashtextextended(target::text,8102));
    if action='ack' then
        update storage_private.cleanup_claims c set completed=true
        where c.user_id=target and exists(select 1 from jsonb_array_elements(items) i
            where i->>'bucket_id'=c.bucket_id and i->>'name'=c.name);
        return '{}'::jsonb;
    end if;
    if action<>'claim' then raise exception 'INVALID_ACTION'; end if;
    insert into storage_private.cleanup_claims(bucket_id,name,user_id)
    select o.bucket_id,o.name,target from storage.objects o
    where o.name collate "C">=target::text||'/' and o.name collate "C"<target::text||'0'
      and o.bucket_id in ('avatars','sessions','venues','vault','expense-receipts')
      and o.created_at<now()-interval '24 hours'
      -- Ambiguous legacy paths are retained for manual review, never guessed.
      and o.name ~ '^[a-zA-Z0-9_./-]+$'
      and not exists(select 1 from storage_private.cleanup_claims c where c.bucket_id=o.bucket_id and c.name=o.name)
      and not exists(select 1 from storage_private.references r where r.bucket_id=o.bucket_id and r.name=o.name)
    order by o.created_at limit 50 on conflict do nothing;
    return jsonb_build_object('objects',coalesce((select jsonb_agg(x) from
        (select bucket_id,name from storage_private.cleanup_claims where user_id=target and not completed limit 50) x),'[]'::jsonb));
end $$;
revoke all on function storage_private.cleanup(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function storage_private.cleanup(text,uuid,jsonb) to service_role;
create function public.storage_cleanup_work(action text,target uuid,items jsonb default '[]') returns jsonb
language sql security invoker set search_path='' as $$select storage_private.cleanup(action,target,items)$$;
revoke all on function public.storage_cleanup_work(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.storage_cleanup_work(text,uuid,jsonb) to service_role;

create function storage_private.read_allowed(bucket text,file_name text) returns boolean
language sql stable security definer set search_path='' as $$
select auth.uid() is not null and account_private.active_user(auth.uid()) and (
    split_part(file_name,'/',1)=auth.uid()::text
    or (bucket='avatars' and exists(select 1 from public.community_profiles p
        where p.is_visible and community_private.profile_allowed(p.user_id)
        and (strpos(coalesce(p.avatar_url,''),'/avatars/'||file_name)>0
            or strpos(coalesce(p.cover_url,''),'/avatars/'||file_name)>0)))
    or (bucket='sessions' and exists(select 1 from public.sessions s
        join public.community_session_shares sh on sh.session_id=s.id
        join public.community_profiles p on p.user_id=sh.user_id
        where p.is_visible and community_private.profile_allowed(p.user_id)
        and community_private.content_allowed('session',s.id)
        and strpos(coalesce(s.poster_url,''),'/sessions/'||file_name)>0))
);
$$;
revoke all on function storage_private.read_allowed(text,text) from public,anon;
grant execute on function storage_private.read_allowed(text,text) to authenticated;
-- Signed access follows publication visibility. Public URL compatibility is
-- retained until the updated native app is released; see docs/almacenamiento.md.
drop policy if exists "Avatar images are publicly accessible" on storage.objects;
drop policy if exists "Avatar images are publicly accessible." on storage.objects;
drop policy if exists "Public Read Access" on storage.objects;
drop policy if exists "Public Read Access Sessions" on storage.objects;
create policy "Published or owned media signed access" on storage.objects for select to authenticated
    using(bucket_id in ('avatars','sessions','venues') and storage_private.read_allowed(bucket_id,name));
