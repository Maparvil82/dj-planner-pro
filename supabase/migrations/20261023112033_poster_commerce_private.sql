-- Commercial preparation only: all public access, sales and promotion switches remain OFF.
-- The existing 500-cent provider ceiling and historical spend are not changed.
create table public.poster_commerce_settings (
 id boolean primary key default true check(id),
 public_enabled boolean not null default false,
 purchases_enabled boolean not null default false,
 promotion_enabled boolean not null default false,
 promotion_ends_at timestamptz not null default '2027-01-20T23:00:00Z',
 promotion_max_units integer not null default 0 check(promotion_max_units>=0),
 promotion_awarded_units integer not null default 0 check(promotion_awarded_units>=0),
 free_seats integer not null default 200 check(free_seats>=0),
 pro_seats integer not null default 50 check(pro_seats>=0)
);
insert into public.poster_commerce_settings(id) values(true);
create table public.poster_commerce_access(user_id uuid primary key references auth.users(id) on delete cascade, enabled boolean not null default false,
 credit_mode text not null default 'production' check(credit_mode in('simulation','production')));
create table public.poster_wallets (
 user_id uuid primary key references auth.users(id) on delete cascade,
 paid_units integer not null default 0, -- Refunds of spent purchases may create debt; never erase it.
 bonus_units integer not null default 0 check(bonus_units>=0),
 reserved_paid_units integer not null default 0 check(reserved_paid_units>=0),
 reserved_bonus_units integer not null default 0 check(reserved_bonus_units>=0 and reserved_bonus_units<=bonus_units)
);
create table public.poster_store_transactions (
 transaction_id text primary key check(length(transaction_id) between 1 and 200),
 user_id uuid references auth.users(id) on delete set null,
 product_id text not null check(product_id in('com.djplannerpro.app.postercredits5','com.djplannerpro.app.postercredits12')),
 quantity integer not null check(quantity between 1 and 10),
 applied_units integer not null default 0 check(applied_units>=0),
 refunded boolean not null default false,
 observed_at_ms bigint not null check(observed_at_ms>0),
 created_at timestamptz not null default now()
);
create index poster_store_transactions_user on public.poster_store_transactions(user_id);
-- Minimal transaction tombstones survive account deletion to prevent replay on a new account.
-- No email, portrait, token, receipt body or payment-card data is stored here.
create table public.poster_credit_ledger (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 dedupe_key text not null unique,
 kind text not null check(kind in('purchase','refund','refund_reversed','promotion','reserve','consume','release')),
 paid_units integer not null default 0,
 bonus_units integer not null default 0,
 created_at timestamptz not null default now()
);
create index poster_credit_ledger_user_created on public.poster_credit_ledger(user_id,created_at desc);
create table public.poster_promotion_claims (
 identity_hash text primary key check(identity_hash ~ '^[a-f0-9]{64}$'),
 user_id uuid references auth.users(id) on delete set null,
 free_claimed boolean not null default false,
 pro_claimed boolean not null default false,
 units integer not null default 0 check(units>=0)
);
create unique index poster_promotion_claims_user on public.poster_promotion_claims(user_id);
do $$ declare t text; begin
 foreach t in array array['poster_commerce_settings','poster_commerce_access','poster_wallets','poster_store_transactions','poster_credit_ledger','poster_promotion_claims'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update on public.%I to service_role',t);
 end loop;
end $$;
grant usage,select on sequence public.poster_credit_ledger_id_seq to service_role;

create function poster_private.credit_mode(p_user uuid) returns text language sql stable security invoker set search_path='' as $$
 select case when not account_private.active_user(p_user) then null
  when exists(select 1 from public.poster_commerce_access where user_id=p_user and not enabled) then null
  when exists(select 1 from public.poster_commerce_access where user_id=p_user and enabled) then (select credit_mode from public.poster_commerce_access where user_id=p_user)
  when exists(select 1 from public.poster_commerce_settings where public_enabled) then 'production'
  when p_user='d5d17646-f273-4fda-b094-ea8a97cb3ad1'::uuid then 'simulation' else null end;
$$;
-- Navigation-only RPC: the Edge Function and reservation independently check access again.
create function public.poster_feature_access() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null)
  and poster_private.credit_mode(auth.uid()) is not null;
$$;
revoke all on function public.poster_feature_access() from public,anon;
grant execute on function public.poster_feature_access() to authenticated;
create function public.poster_account_status(p_user uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare mode text:=poster_private.credit_mode(p_user); b public.poster_ai_budget; w public.poster_wallets; tw public.poster_test_wallets; available integer; credits numeric;
begin
 if mode is null then raise exception 'poster_forbidden'; end if;
 select * into b from public.poster_ai_budget where user_id='d5d17646-f273-4fda-b094-ea8a97cb3ad1';
 available:=greatest(0,b.limit_eur_cents-b.accounted_eur_cents-b.reserved_eur_cents);
 if mode='production' then
  select * into w from public.poster_wallets where user_id=p_user;
  credits:=case when coalesce(w.paid_units,0)<0 then 0 else (greatest(0,coalesce(w.paid_units-w.reserved_paid_units,0))+coalesce(w.bonus_units-w.reserved_bonus_units,0))/2.0 end;
 else
  select * into tw from public.poster_test_wallets where user_id=p_user;
  credits:=coalesce(tw.units-tw.reserved_units,0)/2.0;
 end if;
 return jsonb_build_object('creditMode',mode,'credits',credits,'testCredits',credits,
  'paidCredits',coalesce(w.paid_units,0)/2.0,'bonusCredits',coalesce(w.bonus_units,0)/2.0,
  'sandboxPurchasesEnabled',mode='simulation' and exists(select 1 from public.poster_commerce_access where user_id=p_user and enabled and credit_mode='simulation'),
  'purchasesEnabled',mode='production' and (select purchases_enabled from public.poster_commerce_settings),
  'promotionClaimedCredits',coalesce((select units/2.0 from public.poster_promotion_claims where user_id=p_user),0),
  'promotionAvailable',mode='production' and not exists(select 1 from public.poster_promotion_claims where user_id=p_user and pro_claimed) and (select promotion_enabled and promotion_ends_at>now() and promotion_awarded_units<promotion_max_units from public.poster_commerce_settings),
  'enabled',b.enabled,'canGenerate',b.enabled and available>=75 and credits>=0.5 and not exists(select 1 from public.poster_ai_jobs where user_id=p_user and status in('running','uncertain')),
  'available_eur_cents',available,'reservation_eur_cents',75,'remainingOperations',available/75,
  'limit_eur_cents',b.limit_eur_cents,'reserved_eur_cents',b.reserved_eur_cents,'accounted_eur_cents',b.accounted_eur_cents,'attempts',b.attempts);
end $$;

-- A dedicated Apple-review/test account may use Sandbox without ever funding a paid wallet.
create or replace function public.poster_grant_sandbox_receipt(p_user uuid,p_receipt text,p_product text) returns void language plpgsql security invoker set search_path='' as $$
declare amount integer; existing public.poster_sandbox_receipts;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,8102));
 if poster_private.credit_mode(p_user) is distinct from 'simulation' then raise exception 'poster_forbidden'; end if;
 amount:=case p_product when 'com.djplannerpro.app.postercredits5' then 10 when 'com.djplannerpro.app.postercredits12' then 24 else null end;
 if amount is null or p_receipt is null or length(p_receipt) not between 1 and 200 then raise exception 'poster_invalid_input'; end if;
 insert into public.poster_test_wallets(user_id) values(p_user) on conflict do nothing;
 perform 1 from public.poster_test_wallets where user_id=p_user for update;
 select * into existing from public.poster_sandbox_receipts where receipt_id=p_receipt;
 if found then
  if existing.user_id<>p_user or existing.product_id<>p_product then raise exception 'poster_id_conflict'; end if;return;
 end if;
 insert into public.poster_sandbox_receipts(receipt_id,user_id,product_id,units) values(p_receipt,p_user,p_product,amount);
 update public.poster_test_wallets set units=units+amount where user_id=p_user;
end $$;

-- Called only after a server-to-server read of the current RevenueCat purchase.
-- V2 uses the same store transaction identifier as webhook transaction_id, unlike V1's internal id.
create function public.poster_apply_purchase(p_user uuid,p_transaction text,p_product text,p_quantity integer,p_refunded boolean,p_observed_ms bigint)
returns void language plpgsql security invoker set search_path='' as $$
declare t public.poster_store_transactions; amount integer; delta integer; owner_id uuid;
begin
 if p_transaction is null or length(p_transaction) not between 1 and 200 or p_quantity is null or p_quantity not between 1 and 10 or p_refunded is null or p_observed_ms is null or p_observed_ms<=0 then raise exception 'poster_invalid_input'; end if;
 amount:=case p_product when 'com.djplannerpro.app.postercredits5' then 10 when 'com.djplannerpro.app.postercredits12' then 24 else null end;
 if amount is null then raise exception 'poster_invalid_input'; end if;
 -- Transaction identity lock, then account lock, then wallet: identical for recovery and webhooks.
 perform pg_advisory_xact_lock(hashtextextended(p_transaction,8103));
 select * into t from public.poster_store_transactions where transaction_id=p_transaction;
 if found then
  if t.product_id<>p_product or t.quantity<>p_quantity then raise exception 'poster_id_conflict'; end if;
  if t.user_id is null then return; end if; -- Deleted-account tombstone, never award again.
  if t.user_id<>p_user then raise exception 'poster_store_identity'; end if;
  if p_observed_ms<=t.observed_at_ms then return; end if;
  owner_id:=t.user_id;
 else
  if p_user is null then raise exception 'poster_store_identity'; end if;
  owner_id:=p_user;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,8102));
 select * into t from public.poster_store_transactions where transaction_id=p_transaction for update;
 if found and t.user_id is null then return; end if;
 if not account_private.active_user(owner_id) then raise exception 'poster_forbidden'; end if;
 insert into public.poster_wallets(user_id) values(owner_id) on conflict do nothing;
 perform 1 from public.poster_wallets where user_id=owner_id for update;
 delta:=(case when p_refunded then 0 else amount*p_quantity end)-coalesce(t.applied_units,0);
 if delta<>0 then
  update public.poster_wallets set paid_units=paid_units+delta where user_id=owner_id;
  insert into public.poster_credit_ledger(user_id,dedupe_key,kind,paid_units) values(owner_id,
   'store:'||p_transaction||':'||p_observed_ms,
   case when delta<0 then 'refund' when t.refunded then 'refund_reversed' else 'purchase' end,delta);
 end if;
 insert into public.poster_store_transactions(transaction_id,user_id,product_id,quantity,applied_units,refunded,observed_at_ms)
 values(p_transaction,owner_id,p_product,p_quantity,case when p_refunded then 0 else amount*p_quantity end,p_refunded,p_observed_ms)
 on conflict(transaction_id) do update set applied_units=excluded.applied_units,refunded=excluded.refunded,observed_at_ms=excluded.observed_at_ms;
end $$;

create function public.poster_claim_promotion(p_user uuid,p_identity_hash text,p_pro boolean) returns void language plpgsql security invoker set search_path='' as $$
declare c public.poster_commerce_settings; claim public.poster_promotion_claims; target integer; delta integer;
begin
 if p_identity_hash is null or p_identity_hash!~'^[a-f0-9]{64}$' or p_pro is null or poster_private.credit_mode(p_user) is distinct from 'production' then raise exception 'poster_forbidden'; end if;
 -- Account -> promotion config -> wallet. No external requests inside a database transaction.
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,8102));
 select * into c from public.poster_commerce_settings for update;
 if not c.promotion_enabled or c.promotion_ends_at<=now() then raise exception 'poster_promotion_unavailable'; end if;
 select * into claim from public.poster_promotion_claims where identity_hash=p_identity_hash for update;
 if found and claim.user_id is distinct from p_user then raise exception 'poster_promotion_claimed'; end if;
 target:=case when p_pro then 9 else 3 end;delta:=greatest(0,target-coalesce(claim.units,0));
 if delta=0 then return; end if;
 if c.promotion_awarded_units+delta>c.promotion_max_units then raise exception 'poster_promotion_unavailable'; end if;
 if p_pro and not coalesce(claim.pro_claimed,false) and (select count(*) from public.poster_promotion_claims where pro_claimed)>=c.pro_seats then raise exception 'poster_promotion_unavailable'; end if;
 if not p_pro and not coalesce(claim.free_claimed,false) and (select count(*) from public.poster_promotion_claims where free_claimed)>=c.free_seats then raise exception 'poster_promotion_unavailable'; end if;
 insert into public.poster_wallets(user_id) values(p_user) on conflict do nothing;
 update public.poster_wallets set bonus_units=bonus_units+delta where user_id=p_user;
 insert into public.poster_credit_ledger(user_id,dedupe_key,kind,bonus_units) values(p_user,'welcome:'||p_identity_hash||':'||target,'promotion',delta);
 insert into public.poster_promotion_claims(identity_hash,user_id,units,free_claimed,pro_claimed) values(p_identity_hash,p_user,target,not p_pro,p_pro)
 on conflict(identity_hash) do update set units=excluded.units,free_claimed=poster_promotion_claims.free_claimed or excluded.free_claimed,pro_claimed=poster_promotion_claims.pro_claimed or excluded.pro_claimed;
 update public.poster_commerce_settings set promotion_awarded_units=promotion_awarded_units+delta;
end $$;

alter table public.poster_ai_jobs drop constraint poster_ai_jobs_user_id_check;
alter table public.poster_ai_jobs add column credit_mode text not null default 'simulation' check(credit_mode in('simulation','production')),
 add column paid_credit_units integer not null default 0 check(paid_credit_units between 0 and 2),
 add column bonus_credit_units integer not null default 0 check(bonus_credit_units between 0 and 2),
 add column credit_state text not null default 'legacy' check(credit_state in('legacy','reserved','consumed','released'));
-- Keep the legacy sandbox trigger as-is behind a mode guard.
alter function poster_private.test_wallet_job() rename to test_wallet_job_legacy;
drop trigger poster_test_wallet_reservation on public.poster_ai_jobs;
-- Trigger functions cannot call another trigger function directly: delegate by WHEN instead.
create trigger poster_test_wallet_reservation before insert or update of status on public.poster_ai_jobs
 for each row when(new.credit_mode='simulation') execute function poster_private.test_wallet_job_legacy();
create function poster_private.wallet_job() returns trigger language plpgsql security invoker set search_path='' as $$
declare w public.poster_wallets; charge integer; bonus integer; paid integer;
begin
 if TG_OP='INSERT' then
  charge:=case when new.parent_id is null then 2 else 1 end;
  insert into public.poster_wallets(user_id) values(new.user_id) on conflict do nothing;
  select * into w from public.poster_wallets where user_id=new.user_id for update;
  if w.paid_units<0 or w.paid_units-w.reserved_paid_units+w.bonus_units-w.reserved_bonus_units<charge then raise exception 'poster_credits_empty'; end if;
  bonus:=least(charge,w.bonus_units-w.reserved_bonus_units);paid:=charge-bonus;
  update public.poster_wallets set reserved_paid_units=reserved_paid_units+paid,reserved_bonus_units=reserved_bonus_units+bonus where user_id=new.user_id;
  new.paid_credit_units:=paid;new.bonus_credit_units:=bonus;new.credit_state:='reserved';
  insert into public.poster_credit_ledger(user_id,dedupe_key,kind,paid_units,bonus_units) values(new.user_id,'reserve:'||new.id,'reserve',paid,bonus);
 elsif old.credit_state='reserved' and new.status in('complete','failed') then
  update public.poster_wallets set reserved_paid_units=reserved_paid_units-old.paid_credit_units,reserved_bonus_units=reserved_bonus_units-old.bonus_credit_units,
   paid_units=paid_units-case when new.status='complete' then old.paid_credit_units else 0 end,
   bonus_units=bonus_units-case when new.status='complete' then old.bonus_credit_units else 0 end where user_id=new.user_id;
  new.credit_state:=case when new.status='complete' then 'consumed' else 'released' end;
  insert into public.poster_credit_ledger(user_id,dedupe_key,kind,paid_units,bonus_units) values(new.user_id,new.credit_state||':'||new.id,
   case when new.status='complete' then 'consume' else 'release' end,old.paid_credit_units,old.bonus_credit_units);
 end if;
 return new;
end $$;
create trigger poster_wallet_reservation before insert or update of status on public.poster_ai_jobs
 for each row when(new.credit_mode='production') execute function poster_private.wallet_job();

-- One shared provider budget serializes ALL accounts, including the private sandbox.
create or replace function public.reserve_poster_ai_job(p_id uuid,p_user uuid,p_session uuid,p_parent uuid,p_hash text,p_form jsonb,p_instruction text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare b public.poster_ai_budget; j public.poster_ai_jobs; mode text;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,8102));
 mode:=poster_private.credit_mode(p_user);if mode is null then raise exception 'poster_forbidden'; end if;
 select * into b from public.poster_ai_budget where user_id='d5d17646-f273-4fda-b094-ea8a97cb3ad1' for update;
 select * into j from public.poster_ai_jobs where id=p_id;
 if found then
  if j.user_id<>p_user or j.request_hash<>p_hash then raise exception 'poster_id_conflict'; end if;
  return jsonb_build_object('job',to_jsonb(j),'created',false);
 end if;
 if not b.enabled then raise exception 'poster_disabled'; end if;
 if exists(select 1 from public.poster_ai_jobs where user_id=p_user and status in('running','uncertain')) then raise exception 'poster_busy'; end if;
 if b.accounted_eur_cents+b.reserved_eur_cents+75>b.limit_eur_cents then raise exception 'poster_budget_exhausted'; end if;
 if not exists(select 1 from public.sessions s where s.id=p_session and s.user_id=p_user and s.status<>'cancelled'
  and ((s.date+s.start_time::time) at time zone coalesce(nullif(s.booking_timezone,''),'Europe/Madrid'))>now()) then raise exception 'poster_session_unavailable'; end if;
 if p_parent is not null and not exists(select 1 from public.poster_ai_jobs where id=p_parent and user_id=p_user and session_id=p_session and status='complete') then raise exception 'poster_parent_unavailable'; end if;
 update public.poster_ai_budget set attempts=attempts+1,reserved_eur_cents=reserved_eur_cents+75 where user_id=b.user_id;
 insert into public.poster_ai_jobs(id,user_id,session_id,parent_id,request_hash,form,instruction,credit_mode)
 values(p_id,p_user,p_session,p_parent,p_hash,p_form,p_instruction,mode) returning * into j;
 return jsonb_build_object('job',to_jsonb(j),'created',true);
end $$;
create or replace function public.settle_poster_ai_job(p_id uuid,p_status text,p_usage jsonb,p_output text,p_error text,p_request text,p_no_charge boolean default false)
returns void language plpgsql security invoker set search_path='' as $$
declare b public.poster_ai_budget; j public.poster_ai_jobs; charge integer; owner_id uuid;
begin
 select user_id into owner_id from public.poster_ai_jobs where id=p_id;if not found then return; end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,8102));
 select * into b from public.poster_ai_budget where user_id='d5d17646-f273-4fda-b094-ea8a97cb3ad1' for update;
 select * into j from public.poster_ai_jobs where id=p_id for update;
 if not found or j.status<>'running' then return; end if;
 if p_status not in('complete','failed','uncertain') then raise exception 'poster_invalid_status'; end if;
 if p_output is not null and p_output not in (j.user_id::text||'/'||j.id::text||'.jpg',j.user_id::text||'/'||j.id::text||'.png') then raise exception 'poster_invalid_output'; end if;
 charge:=poster_private.usage_eur_cents(coalesce(p_usage,j.usage));
 if p_no_charge and p_status='failed' and p_error in('poster_provider_key','poster_provider_quota','poster_provider_rejected','poster_parent_unavailable') and coalesce(p_usage,j.usage) is null then charge:=0; end if;
 if charge is not null and j.budget_settled_at is null then
  update public.poster_ai_budget set reserved_eur_cents=greatest(0,reserved_eur_cents-j.reserved_eur_cents),accounted_eur_cents=accounted_eur_cents+charge,
   enabled=enabled and (accounted_eur_cents+charge+greatest(0,reserved_eur_cents-j.reserved_eur_cents)<=limit_eur_cents) where user_id=b.user_id;
 end if;
 update public.poster_ai_jobs set status=p_status,usage=coalesce(p_usage,usage),output_path=coalesce(p_output,output_path),error_code=p_error,
  provider_request_id=coalesce(p_request,provider_request_id),completed_at=now(),accounted_eur_cents=coalesce(accounted_eur_cents,charge),
  budget_settled_at=case when charge is not null then coalesce(budget_settled_at,now()) else budget_settled_at end where id=p_id;
end $$;
create or replace function poster_private.storage_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 if new.bucket_id='poster-ai-private' then
  target:=split_part(new.name,'/',1)::uuid;
  perform pg_advisory_xact_lock(hashtextextended(target::text,8102));
  if not account_private.active_user(target) or not exists(select 1 from public.poster_ai_jobs where user_id=target and status='running'
   and new.name in(user_id::text||'/'||id::text||'.jpg',user_id::text||'/'||id::text||'.png')) then raise exception 'poster_forbidden'; end if;
 end if;return new;
end $$;
do $$ declare sig text; begin
 foreach sig in array array['poster_private.credit_mode(uuid)','public.poster_account_status(uuid)','public.poster_apply_purchase(uuid,text,text,integer,boolean,bigint)',
  'public.poster_claim_promotion(uuid,text,boolean)','poster_private.wallet_job()'] loop
  execute 'revoke all on function '||sig||' from public,anon,authenticated';
  execute 'grant execute on function '||sig||' to service_role';
 end loop;
end $$;
