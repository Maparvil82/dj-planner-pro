-- Replace attempt-count gating with metered accounting; owner and 500-cent ceiling unchanged.
alter table public.poster_ai_budget drop constraint poster_ai_budget_attempts_check;
alter table public.poster_ai_budget add constraint poster_ai_budget_attempts_check check (attempts>=0);
alter table public.poster_ai_budget add column accounted_eur_cents integer not null default 0 check (accounted_eur_cents>=0);
alter table public.poster_ai_jobs drop constraint poster_ai_jobs_reserved_eur_cents_check;
alter table public.poster_ai_jobs alter column reserved_eur_cents set default 100;
alter table public.poster_ai_jobs add constraint poster_ai_jobs_reserved_eur_cents_check check (reserved_eur_cents between 0 and 500);
alter table public.poster_ai_jobs add column accounted_eur_cents integer check (accounted_eur_cents>=0);
alter table public.poster_ai_jobs add column budget_settled_at timestamptz;

-- Conservative upper estimate: text $5, image input $8, output $30 / million.
-- 250 EUR cents per USD includes FX/tax safety headroom, NOT a live exchange rate.
-- Never subtract cached-token discounts. Missing/malformed usage retains its reservation.
create function poster_private.usage_eur_cents(u jsonb) returns integer
language plpgsql immutable security invoker set search_path='' as $$
declare t numeric; i numeric; o numeric;
begin
 if jsonb_typeof(u)<>'object' or u is null then return null; end if;
 if coalesce(u#>>'{input_tokens_details,text_tokens}','')!~'^[0-9]{1,7}$' or coalesce(u#>>'{input_tokens_details,image_tokens}','')!~'^[0-9]{1,7}$' or coalesce(u->>'output_tokens','')!~'^[0-9]{1,7}$' then return null; end if;
 t:=(u#>>'{input_tokens_details,text_tokens}')::numeric;
 i:=(u#>>'{input_tokens_details,image_tokens}')::numeric;
 o:=(u->>'output_tokens')::numeric;
 if t+i+o=0 then return null; end if;
 return ceil((t*5+i*8+o*30)*250/1000000)::integer;
end $$;
revoke all on function poster_private.usage_eur_cents(jsonb) from public,anon,authenticated;
grant usage on schema poster_private to service_role;
grant execute on function poster_private.usage_eur_cents(jsonb) to service_role;

-- Bring ALL previous jobs into the same ledger, preserving raw usage and prior audit notes.
update public.poster_ai_jobs set accounted_eur_cents=poster_private.usage_eur_cents(usage),budget_settled_at=now()
where poster_private.usage_eur_cents(usage) is not null and status in('complete','failed','uncertain');
update public.poster_ai_jobs set accounted_eur_cents=0,budget_settled_at=now()
where status='failed' and usage is null and output_path is null and error_code in('poster_provider_quota','poster_provider_quota_reconciled','poster_provider_key','poster_provider_rejected');
update public.poster_ai_budget b set
 accounted_eur_cents=coalesce((select sum(j.accounted_eur_cents) from public.poster_ai_jobs j where j.user_id=b.user_id),0),
 reserved_eur_cents=coalesce((select sum(j.reserved_eur_cents) from public.poster_ai_jobs j where j.user_id=b.user_id and j.budget_settled_at is null),0),
 attempts=(select count(*) from public.poster_ai_jobs j where j.user_id=b.user_id);

create or replace function public.reserve_poster_ai_job(p_id uuid,p_user uuid,p_session uuid,p_parent uuid,p_hash text,p_form jsonb,p_instruction text)
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
  if b.accounted_eur_cents+b.reserved_eur_cents+100>b.limit_eur_cents then raise exception 'poster_budget_exhausted'; end if;
  if not exists(select 1 from public.sessions s where s.id=p_session and s.user_id=p_user and s.status<>'cancelled'
    and ((s.date+s.start_time::time) at time zone coalesce(nullif(s.booking_timezone,''),'Europe/Madrid'))>now()) then
    raise exception 'poster_session_unavailable';
  end if;
  if p_parent is not null and not exists(select 1 from public.poster_ai_jobs where id=p_parent and user_id=p_user and session_id=p_session and status='complete') then raise exception 'poster_parent_unavailable'; end if;
  update public.poster_ai_budget set attempts=attempts+1,reserved_eur_cents=reserved_eur_cents+100 where user_id=p_user;
  insert into public.poster_ai_jobs(id,user_id,session_id,parent_id,request_hash,form,instruction)
  values(p_id,p_user,p_session,p_parent,p_hash,p_form,p_instruction) returning * into j;
  return jsonb_build_object('job',to_jsonb(j),'created',true);
end; $$;

-- Finalize metering and job status atomically, once per job. No client access.
create function public.settle_poster_ai_job(p_id uuid,p_status text,p_usage jsonb,p_output text,p_error text,p_request text,p_no_charge boolean default false)
returns void language plpgsql security invoker set search_path='' as $$
declare b public.poster_ai_budget; j public.poster_ai_jobs; charge integer;
begin
 select * into b from public.poster_ai_budget where user_id='d5d17646-f273-4fda-b094-ea8a97cb3ad1' for update;
 select * into j from public.poster_ai_jobs where id=p_id and user_id=b.user_id for update;
 if not found or j.status<>'running' then return; end if;
 if p_status not in('complete','failed','uncertain') then raise exception 'poster_invalid_status'; end if;
 charge:=poster_private.usage_eur_cents(coalesce(p_usage,j.usage));
 if p_no_charge and p_status='failed' and p_error in('poster_provider_key','poster_provider_quota','poster_provider_rejected','poster_parent_unavailable') and coalesce(p_usage,j.usage) is null then charge:=0; end if;
 if charge is not null and j.budget_settled_at is null then
   update public.poster_ai_budget set reserved_eur_cents=greatest(0,reserved_eur_cents-j.reserved_eur_cents),
     accounted_eur_cents=accounted_eur_cents+charge,
     enabled=enabled and (accounted_eur_cents+charge+greatest(0,reserved_eur_cents-j.reserved_eur_cents)<=limit_eur_cents)
   where user_id=j.user_id;
 end if;
 update public.poster_ai_jobs set status=p_status,usage=coalesce(p_usage,usage),output_path=coalesce(p_output,output_path),error_code=p_error,
   provider_request_id=coalesce(p_request,provider_request_id),completed_at=now(),
   accounted_eur_cents=coalesce(accounted_eur_cents,charge),
   budget_settled_at=case when charge is not null then coalesce(budget_settled_at,now()) else budget_settled_at end
 where id=p_id;
end $$;
revoke all on function public.settle_poster_ai_job(uuid,text,jsonb,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.settle_poster_ai_job(uuid,text,jsonb,text,text,text,boolean) to service_role;
