-- Recovery never repeats a provider request. Only trusted server code can settle jobs.
alter table public.poster_ai_jobs
 add column provider_started_at timestamptz,
 add column recovered_at timestamptz,
 add column provider_cost_estimated boolean not null default false;
create index poster_ai_jobs_recovery_due on public.poster_ai_jobs(created_at,user_id)
 where status in ('running','uncertain');

create function public.poster_begin_provider(p_id uuid,p_user uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,8102));
 update public.poster_ai_jobs set provider_started_at=clock_timestamp()
  where id=p_id and user_id=p_user and status='running' and provider_started_at is null
   and created_at>now()-interval '10 minutes' and account_private.active_user(p_user);
 return found;
end $$;
revoke all on function public.poster_begin_provider(uuid,uuid) from public,anon,authenticated;
grant execute on function public.poster_begin_provider(uuid,uuid) to service_role;

create or replace function public.settle_poster_ai_job(p_id uuid,p_status text,p_usage jsonb,p_output text,p_error text,p_request text,p_no_charge boolean default false)
returns void language plpgsql security invoker set search_path='' as $$
declare b public.poster_ai_budget; j public.poster_ai_jobs; charge integer; owner_id uuid; estimated boolean:=false;
begin
 select user_id into owner_id from public.poster_ai_jobs where id=p_id;if not found then return; end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,8102));
 select * into b from public.poster_ai_budget where user_id='d5d17646-f273-4fda-b094-ea8a97cb3ad1' for update;
 select * into j from public.poster_ai_jobs where id=p_id for update;
 if not found or j.status not in('running','uncertain') then return; end if;
 if p_status not in('complete','failed','uncertain') then raise exception 'poster_invalid_status'; end if;
 if p_output is not null and p_output not in (j.user_id::text||'/'||j.id::text||'.jpg',j.user_id::text||'/'||j.id::text||'.png') then raise exception 'poster_invalid_output'; end if;
 if p_status='complete' and coalesce(p_output,j.output_path) is null then raise exception 'poster_invalid_output'; end if;
 charge:=poster_private.usage_eur_cents(coalesce(p_usage,j.usage));
 if p_no_charge and p_status='failed' and p_error in('poster_provider_key','poster_provider_quota','poster_provider_rejected','poster_parent_unavailable','poster_not_sent') and coalesce(p_usage,j.usage) is null then charge:=0; end if;
 -- Unknown provider cost remains conservatively accounted to the operator, even
 -- when the user's credit is released. Never turn an ambiguous outcome into free budget.
 if charge is null and (p_status='complete' or (p_status='failed' and p_error='poster_generation_interrupted')) then
  charge:=j.reserved_eur_cents;estimated:=true;
 end if;
 if charge is not null and j.budget_settled_at is null then
  update public.poster_ai_budget set reserved_eur_cents=greatest(0,reserved_eur_cents-j.reserved_eur_cents),accounted_eur_cents=accounted_eur_cents+charge,
   enabled=enabled and (accounted_eur_cents+charge+greatest(0,reserved_eur_cents-j.reserved_eur_cents)<=limit_eur_cents) where user_id=b.user_id;
 end if;
 update public.poster_ai_jobs set status=p_status,usage=coalesce(p_usage,usage),output_path=coalesce(p_output,output_path),error_code=p_error,
  provider_request_id=coalesce(p_request,provider_request_id),completed_at=now(),accounted_eur_cents=coalesce(accounted_eur_cents,charge),
  provider_cost_estimated=provider_cost_estimated or (estimated and budget_settled_at is null),
  budget_settled_at=case when charge is not null then coalesce(budget_settled_at,now()) else budget_settled_at end where id=p_id;
end $$;

create function public.poster_recover_job(p_user uuid,p_base_url text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare j public.poster_ai_jobs; output text; session_path text; session_url text;
begin
 if not account_private.active_user(p_user) then return null; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,8102));
 -- The per-user lock fences settlement and Storage. Healthy reads do not lock
 -- the shared budget; acquire it only when a recovery can actually finish.
 select * into j from public.poster_ai_jobs where user_id=p_user and status in('running','uncertain') order by created_at limit 1;
 if not found then return null; end if;
 if j.status='running' and j.created_at>now()-interval '10 minutes' then return null; end if;
 -- Deterministic immutable paths allow recovery even if upload succeeded and the
 -- following database write/HTTP response was lost. Never trust a client path.
 select o.name into output from storage.objects o where o.bucket_id='poster-ai-private'
  and o.name in(j.user_id::text||'/'||j.id::text||'.jpg',j.user_id::text||'/'||j.id::text||'.png') order by o.name limit 1;
 if output is null and j.created_at>now()-interval '10 minutes' then return null; end if;
 -- Same write-lock order as reservation and settlement: budget, then job.
 perform 1 from public.poster_ai_budget where user_id='d5d17646-f273-4fda-b094-ea8a97cb3ad1' for update;
 select p.* into j from public.poster_ai_jobs p where p.id=j.id for update;
 if j.status not in('running','uncertain') then return null; end if;
 if output is not null then
  session_path:=j.user_id::text||'/poster_ai_'||j.id::text||'.jpg';
  if p_base_url is not null and exists(select 1 from storage.objects where bucket_id='sessions' and name=session_path) then
   session_url:=rtrim(p_base_url,'/')||'/storage/v1/object/public/sessions/'||session_path;
   update public.poster_ai_jobs set session_poster_url=session_url where id=j.id;
  end if;
  perform public.settle_poster_ai_job(j.id,'complete',null,output,null,null,false);
 elsif j.created_at<=now()-interval '10 minutes' then
  perform public.settle_poster_ai_job(j.id,'failed',null,null,'poster_generation_interrupted',null,false);
 else return null;
 end if;
 update public.poster_ai_jobs set recovered_at=now() where id=j.id returning * into j;
 return to_jsonb(j);
end $$;
revoke all on function public.poster_recover_job(uuid,text) from public,anon,authenticated;
grant execute on function public.poster_recover_job(uuid,text) to service_role;

create function poster_private.recover_stale_jobs() returns integer
language plpgsql security invoker set search_path='' as $$
declare job record; recovered integer:=0;
begin
 for job in select user_id from public.poster_ai_jobs where status in('running','uncertain')
  and created_at<=now()-interval '10 minutes' and account_private.active_user(user_id) order by created_at limit 200 loop
  begin
   if public.poster_recover_job(job.user_id,'https://voyurnwckmateohuzbab.supabase.co') is not null then recovered:=recovered+1; end if;
  exception when others then
   raise warning 'poster recovery deferred, SQLSTATE %',SQLSTATE;
  end;
 end loop;
 return recovered;
end $$;
revoke all on function poster_private.recover_stale_jobs() from public,anon,authenticated;
grant execute on function poster_private.recover_stale_jobs() to service_role;
