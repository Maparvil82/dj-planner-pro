-- Calibrate owner-only beta; total remains 500 cents.
-- ECB 2026-10-16: EUR 1 = USD 1.1253 (USD 1 ~= EUR 0.889).
-- Provision EUR 1.25/USD includes conversion/tax headroom; not an invoiced FX rate.
-- Reserve EUR 0.75 temporarily with unchanged pinned model, image count and sizes.
do $$ begin perform 1 from public.poster_ai_budget where user_id='d5d17646-f273-4fda-b094-ea8a97cb3ad1' for update; end $$;
alter table public.poster_ai_jobs alter column reserved_eur_cents set default 75;
create or replace function poster_private.usage_eur_cents(u jsonb) returns integer
language plpgsql immutable security invoker set search_path='' as $$
declare t numeric; i numeric; o numeric;
begin
 if jsonb_typeof(u)<>'object' or u is null then return null; end if;
 if coalesce(u#>>'{input_tokens_details,text_tokens}','')!~'^[0-9]{1,7}$' or coalesce(u#>>'{input_tokens_details,image_tokens}','')!~'^[0-9]{1,7}$' or coalesce(u->>'output_tokens','')!~'^[0-9]{1,7}$' then return null; end if;
 t:=(u#>>'{input_tokens_details,text_tokens}')::numeric;
 i:=(u#>>'{input_tokens_details,image_tokens}')::numeric;
 o:=(u->>'output_tokens')::numeric;
 if t+i+o=0 then return null; end if;
 return ceil((t*5+i*8+o*30)*125/1000000)::integer;
end $$;
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
  if b.accounted_eur_cents+b.reserved_eur_cents+75>b.limit_eur_cents then raise exception 'poster_budget_exhausted'; end if;
  if not exists(select 1 from public.sessions s where s.id=p_session and s.user_id=p_user and s.status<>'cancelled'
    and ((s.date+s.start_time::time) at time zone coalesce(nullif(s.booking_timezone,''),'Europe/Madrid'))>now()) then
    raise exception 'poster_session_unavailable';
  end if;
  if p_parent is not null and not exists(select 1 from public.poster_ai_jobs where id=p_parent and user_id=p_user and session_id=p_session and status='complete') then raise exception 'poster_parent_unavailable'; end if;
  update public.poster_ai_budget set attempts=attempts+1,reserved_eur_cents=reserved_eur_cents+75 where user_id=p_user;
  insert into public.poster_ai_jobs(id,user_id,session_id,parent_id,request_hash,form,instruction)
  values(p_id,p_user,p_session,p_parent,p_hash,p_form,p_instruction) returning * into j;
  return jsonb_build_object('job',to_jsonb(j),'created',true);
end; $$;

-- Recalculate metered jobs only. Unknown outcomes retain their original reservations.
update public.poster_ai_jobs set accounted_eur_cents=poster_private.usage_eur_cents(usage)
where budget_settled_at is not null and poster_private.usage_eur_cents(usage) is not null;
update public.poster_ai_budget b set
 accounted_eur_cents=coalesce((select sum(j.accounted_eur_cents) from public.poster_ai_jobs j where j.user_id=b.user_id),0),
 reserved_eur_cents=coalesce((select sum(j.reserved_eur_cents) from public.poster_ai_jobs j where j.user_id=b.user_id and j.budget_settled_at is null),0);
