-- Owner-only beta. All writes go through the authenticated Edge Function.
create table public.poster_ai_budget (
  user_id uuid primary key references auth.users(id) on delete cascade,
  limit_eur_cents integer not null check (limit_eur_cents = 500),
  reserved_eur_cents integer not null default 0 check (reserved_eur_cents between 0 and 500),
  attempts integer not null default 0 check (attempts between 0 and 2),
  enabled boolean not null default false,
  check (user_id = 'd5d17646-f273-4fda-b094-ea8a97cb3ad1'::uuid)
);
alter table public.poster_ai_budget enable row level security;
revoke all on public.poster_ai_budget from anon, authenticated;
grant all on public.poster_ai_budget to service_role;
insert into public.poster_ai_budget(user_id, limit_eur_cents)
values ('d5d17646-f273-4fda-b094-ea8a97cb3ad1', 500);

create table public.poster_ai_jobs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  parent_id uuid references public.poster_ai_jobs(id),
  request_hash text not null,
  status text not null default 'running' check (status in ('running','complete','failed','uncertain')),
  form jsonb not null,
  instruction text,
  output_path text,
  usage jsonb,
  provider_request_id text,
  error_code text,
  reserved_eur_cents integer not null default 250 check (reserved_eur_cents = 250),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (user_id = 'd5d17646-f273-4fda-b094-ea8a97cb3ad1'::uuid)
);
create unique index poster_ai_one_active on public.poster_ai_jobs(user_id) where status in ('running','uncertain');
create index poster_ai_jobs_owner_created on public.poster_ai_jobs(user_id,created_at desc);
alter table public.poster_ai_jobs enable row level security;
revoke all on public.poster_ai_jobs from anon, authenticated;
grant all on public.poster_ai_jobs to service_role;

-- Invoker + explicit service-only EXECUTE. Row lock serializes budget reservations.
grant execute on function account_private.active_user(uuid) to service_role;
create function public.reserve_poster_ai_job(p_id uuid,p_user uuid,p_session uuid,p_parent uuid,p_hash text,p_form jsonb,p_instruction text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare b public.poster_ai_budget; j public.poster_ai_jobs;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,8102));
  if not account_private.active_user(p_user) then raise exception 'poster_forbidden'; end if;
  select * into b from public.poster_ai_budget where user_id=p_user for update;
  if not found then raise exception 'poster_forbidden'; end if;
  select * into j from public.poster_ai_jobs where id=p_id;
  if found then
    if j.user_id<>p_user or j.request_hash<>p_hash then raise exception 'poster_id_conflict'; end if;
    return jsonb_build_object('job',to_jsonb(j),'created',false);
  end if;
  if not b.enabled then raise exception 'poster_disabled'; end if;
  if exists(select 1 from public.poster_ai_jobs where user_id=p_user and status in ('running','uncertain')) then raise exception 'poster_busy'; end if;
  if b.attempts>=2 or b.reserved_eur_cents+250>b.limit_eur_cents then raise exception 'poster_budget_exhausted'; end if;
  if not exists(select 1 from public.sessions s where s.id=p_session and s.user_id=p_user and s.status<>'cancelled'
    and ((s.date+s.start_time::time) at time zone coalesce(nullif(s.booking_timezone,''),'Europe/Madrid'))>now()) then
    raise exception 'poster_session_unavailable';
  end if;
  if p_parent is not null and not exists(select 1 from public.poster_ai_jobs where id=p_parent and user_id=p_user and session_id=p_session and status='complete') then raise exception 'poster_parent_unavailable'; end if;
  update public.poster_ai_budget set attempts=attempts+1,reserved_eur_cents=reserved_eur_cents+250 where user_id=p_user;
  insert into public.poster_ai_jobs(id,user_id,session_id,parent_id,request_hash,form,instruction)
  values(p_id,p_user,p_session,p_parent,p_hash,p_form,p_instruction) returning * into j;
  return jsonb_build_object('job',to_jsonb(j),'created',true);
end; $$;
revoke all on function public.reserve_poster_ai_job(uuid,uuid,uuid,uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.reserve_poster_ai_job(uuid,uuid,uuid,uuid,text,jsonb,text) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('poster-ai-private','poster-ai-private',false,10485760,array['image/png','image/jpeg']);
-- No client storage policies: Edge Function authorizes each signed download.

-- Include generated files in the existing account-deletion flow.
do $migration$
declare signature text; definition text;
begin
  foreach signature in array array['account_private.work(text,uuid)','account_private.finalize_guard()'] loop
    definition := pg_get_functiondef(signature::regprocedure);
    execute replace(definition, $old$'expense-receipts')$old$, $new$'expense-receipts','poster-ai-private')$new$);
  end loop;
end $migration$;

create schema poster_private;
revoke all on schema poster_private from public,anon,authenticated;
create function poster_private.storage_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
  if new.bucket_id='poster-ai-private' then
    target:=split_part(new.name,'/',1)::uuid;
    perform pg_advisory_xact_lock(hashtextextended(target::text,8102));
    if target<>'d5d17646-f273-4fda-b094-ea8a97cb3ad1'::uuid or not account_private.active_user(target) then raise exception 'poster_forbidden'; end if;
  end if;
  return new;
end $$;
revoke all on function poster_private.storage_guard() from public,anon,authenticated;
create trigger poster_ai_storage_guard before insert or update on storage.objects for each row execute function poster_private.storage_guard();
