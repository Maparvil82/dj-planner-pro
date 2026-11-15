-- PostgREST loads safeupdate: even singleton updates must have a WHERE clause.
-- Keep the same amounts, identity checks, campaign and all existing balances.
create or replace function public.poster_claim_promotion(p_user uuid,p_identity_hash text,p_pro boolean) returns void language plpgsql security invoker set search_path='' as $$
declare c public.poster_commerce_settings; claim public.poster_promotion_claims; target integer; delta integer;
begin
 if p_identity_hash is null or p_identity_hash!~'^[a-f0-9]{64}$' or p_pro is null or poster_private.credit_mode(p_user) is distinct from 'production' then raise exception 'poster_forbidden'; end if;
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
