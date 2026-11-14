-- Welcome credits follow the Pro access already verified by the server. No new client permissions.
create or replace function public.poster_account_status(p_user uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare mode text:=poster_private.credit_mode(p_user); b public.poster_ai_budget; w public.poster_wallets; tw public.poster_test_wallets; available integer; credits numeric; pro_active boolean;
begin
 if mode is null then raise exception 'poster_forbidden'; end if;
 pro_active:=exists(select 1 from billing_private.pro_trials where user_id=p_user and expires_at>now()) or exists(select 1 from billing_private.subscription_access where user_id=p_user and pro_until>now());
 select * into b from public.poster_ai_budget where user_id='d5d17646-f273-4fda-b094-ea8a97cb3ad1';
 available:=greatest(0,b.limit_eur_cents-b.accounted_eur_cents-b.reserved_eur_cents);
 if mode='production' then
  select * into w from public.poster_wallets where user_id=p_user;
  credits:=case when coalesce(w.paid_units,0)<0 then 0 else (greatest(0,coalesce(w.paid_units-w.reserved_paid_units,0))+coalesce(w.bonus_units-w.reserved_bonus_units,0))/2.0 end;
 else
  select * into tw from public.poster_test_wallets where user_id=p_user;
  credits:=coalesce(tw.units-tw.reserved_units,0)/2.0;
 end if;
 return jsonb_build_object('creditMode',mode,'proActive',pro_active,'credits',credits,'testCredits',credits,
  'paidCredits',coalesce(w.paid_units,0)/2.0,'bonusCredits',coalesce(w.bonus_units,0)/2.0,
  'sandboxPurchasesEnabled',mode='simulation' and exists(select 1 from public.poster_commerce_access where user_id=p_user and enabled and credit_mode='simulation'),
  'purchasesEnabled',mode='production' and (select purchases_enabled from public.poster_commerce_settings),
  'promotionClaimedCredits',coalesce((select units/2.0 from public.poster_promotion_claims where user_id=p_user),0),
  'promotionAvailable',mode='production' and not exists(select 1 from public.poster_promotion_claims where user_id=p_user and pro_claimed) and (select promotion_enabled and promotion_ends_at>now() and promotion_awarded_units<promotion_max_units from public.poster_commerce_settings),
  'enabled',b.enabled,'canGenerate',b.enabled and available>=75 and credits>=0.5 and not exists(select 1 from public.poster_ai_jobs where user_id=p_user and status in('running','uncertain')),
  'available_eur_cents',available,'reservation_eur_cents',75,'remainingOperations',available/75,
  'limit_eur_cents',b.limit_eur_cents,'reserved_eur_cents',b.reserved_eur_cents,'accounted_eur_cents',b.accounted_eur_cents,'attempts',b.attempts);
end $$;

create or replace function public.poster_claim_promotion(p_user uuid,p_identity_hash text,p_pro boolean) returns void language plpgsql security invoker set search_path='' as $$
declare c public.poster_commerce_settings; claim public.poster_promotion_claims; target integer; delta integer;
begin
 if p_identity_hash is null or p_identity_hash!~'^[a-f0-9]{64}$' or p_pro is null or poster_private.credit_mode(p_user) is distinct from 'production' then raise exception 'poster_forbidden'; end if;
 -- Match the same server-side Pro access used by the app badge, including the active standalone trial.
 p_pro:=p_pro or exists(select 1 from billing_private.pro_trials where user_id=p_user and expires_at>now()) or exists(select 1 from billing_private.subscription_access where user_id=p_user and pro_until>now());
 -- Account -> promotion config -> wallet. No external requests inside a database transaction.
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,8102));
 select * into c from public.poster_commerce_settings for update;
 if not c.promotion_enabled or c.promotion_ends_at<=now() then raise exception 'poster_promotion_unavailable'; end if;
 select * into claim from public.poster_promotion_claims where identity_hash=p_identity_hash for update;
 if found and claim.user_id is distinct from p_user then raise exception 'poster_promotion_claimed'; end if;
 target:=case when p_pro then 10 else 6 end;delta:=greatest(0,target-coalesce(claim.units,0));
 if delta=0 then return; end if;
 if c.promotion_awarded_units+delta>c.promotion_max_units then raise exception 'poster_promotion_unavailable'; end if;
 if p_pro and not coalesce(claim.pro_claimed,false) and (select count(*) from public.poster_promotion_claims where pro_claimed)>=c.pro_seats then raise exception 'poster_promotion_unavailable'; end if;
 if not p_pro and not coalesce(claim.free_claimed,false) and (select count(*) from public.poster_promotion_claims where free_claimed)>=c.free_seats then raise exception 'poster_promotion_unavailable'; end if;
 insert into public.poster_wallets(user_id) values(p_user) on conflict do nothing;
 update public.poster_wallets set bonus_units=bonus_units+delta where user_id=p_user;
 insert into public.poster_credit_ledger(user_id,dedupe_key,kind,bonus_units) values(p_user,'welcome:'||p_identity_hash||':'||target,'promotion',delta);
 insert into public.poster_promotion_claims(identity_hash,user_id,units,free_claimed,pro_claimed) values(p_identity_hash,p_user,target,not p_pro,p_pro)
 on conflict(identity_hash) do update set units=excluded.units,free_claimed=poster_promotion_claims.free_claimed or excluded.free_claimed,pro_claimed=poster_promotion_claims.pro_claimed or excluded.pro_claimed;
 update public.poster_commerce_settings set promotion_awarded_units=promotion_awarded_units+delta where id=true;
end $$;


-- Top up existing eligible welcome claims through the ledger; never reset spent or purchased credits.
do $top_up$ declare c record; begin
 for c in select p.user_id,p.identity_hash from public.poster_promotion_claims p
 where p.user_id is not null and p.units<10 and
 (exists(select 1 from billing_private.pro_trials t where t.user_id=p.user_id and t.expires_at>now())
 or exists(select 1 from billing_private.subscription_access s where s.user_id=p.user_id and s.pro_until>now()))
 loop perform public.poster_claim_promotion(c.user_id,c.identity_hash,true); end loop;
end $top_up$;
