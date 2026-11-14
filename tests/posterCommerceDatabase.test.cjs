const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const {PGlite}=require('@electric-sql/pglite');
const owner='d5d17646-f273-4fda-b094-ea8a97cb3ad1',a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
const sa='aaaa1111-1111-4111-8111-111111111111',sb='bbbb2222-2222-4222-8222-222222222222';
const id=n=>`${String(n).padStart(8,'0')}-1234-4234-8234-123456789012`;
const product='com.djplannerpro.app.postercredits5';
const usage={_provider:'vertex',_model:'gemini-3.1-flash-image',usageMetadata:{promptTokenCount:2644,totalTokenCount:3764,candidatesTokenCount:1120}};
async function setup(){
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create schema account_private;
 create table auth.users(id uuid primary key,email_confirmed_at timestamptz default now());
 create function auth.uid() returns uuid language sql as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
 create table public.sessions(id uuid primary key,user_id uuid,date date,start_time text,status text,booking_timezone text);
 create table storage.objects(bucket_id text,name text);create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create function account_private.active_user(target uuid) returns boolean language sql security definer as 'select exists(select 1 from auth.users where id=target)';
 create function account_private.work(text,uuid) returns jsonb language sql as 'select null::jsonb';create function account_private.finalize_guard() returns trigger language plpgsql as 'begin return old; end';
 grant usage on schema account_private to service_role;grant select on public.sessions to service_role;
 insert into auth.users(id) values('${owner}'),('${a}'),('${b}');
 insert into public.sessions values('${sa}','${a}','2099-12-24','23:30','confirmed','Europe/Madrid'),('${sb}','${b}','2099-12-24','23:30','confirmed','Europe/Madrid');`);
 for(const name of ['20261018235804_poster_ai_private_beta.sql','20261019012700_poster_ai_metered_budget.sql','20261019032802_poster_ai_calibrated_budget.sql','20261021013422_poster_test_credit_wallet.sql','20261021122711_poster_apple_sandbox_receipts.sql','20261022224311_poster_google_metering.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+name,'utf8'));
 await db.exec(`update public.poster_ai_budget set enabled=true,accounted_eur_cents=286;insert into public.poster_test_wallets(user_id,units) values('${owner}',18);`);
 return db;
}
const purchase=(db,transaction,user=a,refunded=false,stamp=1000,quantity=1)=>db.query('select public.poster_apply_purchase($1,$2,$3,$4,$5,$6)',[user,transaction,product,quantity,refunded,stamp]);
const wallet=async(db,user=a)=>(await db.query('select * from public.poster_wallets where user_id=$1',[user])).rows[0];
const budget=async db=>(await db.query('select * from public.poster_ai_budget')).rows[0];
const reserve=(db,n,user=a,session=sa,parent=null)=>db.query('select public.reserve_poster_ai_job($1,$2,$3,$4,$5,$6,null) as result',[id(n),user,session,parent,'hash-'+n,{title:'Session',format:'Cartel'}]);
const finish=(db,n,status='complete',user=a,u=usage,code=null,noCharge=false)=>db.query('select public.settle_poster_ai_job($1,$2,$3,$4,$5,null,$6)',[id(n),status,u,status==='complete'?`${user}/${id(n)}.jpg`:null,code,noCharge]);
test('commercial wallets and per-account jobs keep production private and share the unchanged provider ceiling',async t=>{
 const db=await setup();try{
 const previous=await budget(db);await db.exec(fs.readFileSync('supabase/migrations/20261023112033_poster_commerce_private.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261023122510_poster_navigation_access.sql','utf8'));
 await t.test('migration preserves legacy money and credits; public, purchases and gifts default off',async()=>{
  assert.deepEqual(await budget(db),previous);
  assert.equal((await db.query('select units from public.poster_test_wallets')).rows[0].units,18);
  const settings=(await db.query('select * from public.poster_commerce_settings')).rows[0];for(const key of ['public_enabled','purchases_enabled','promotion_enabled'])assert.equal(settings[key],false);
  await assert.rejects(reserve(db,1),/poster_forbidden/);
  assert.equal((await db.query('select poster_private.credit_mode($1) as mode',[owner])).rows[0].mode,'simulation');
  await db.exec(`insert into public.poster_commerce_access(user_id,enabled) values('${a}',true),('${b}',true)`);
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${a}'`);
  assert.equal((await db.query('select public.poster_feature_access() as allowed')).rows[0].allowed,true);
  await db.exec("set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333'");
  assert.equal((await db.query('select public.poster_feature_access() as allowed')).rows[0].allowed,false);
  await db.exec('reset role');
 });
 await t.test('server-verified purchases are idempotent across sync, webhook duplicates and stale refund events',async()=>{
  await purchase(db,'purchase-a');await purchase(db,'purchase-a');await purchase(db,'purchase-a',a,false,1100);assert.equal((await wallet(db)).paid_units,10);
  await assert.rejects(purchase(db,'purchase-a',b,false,1200),/poster_store_identity/);
  await purchase(db,'refund-first',b,true,2000);await purchase(db,'refund-first',b,false,1000);assert.equal((await wallet(db,b)).paid_units,0);
  await purchase(db,'refund-first',b,false,3000);await purchase(db,'refund-first',b,true,2000);assert.equal((await wallet(db,b)).paid_units,10);
  await purchase(db,'refund-first',b,true,4000);await purchase(db,'refund-first',b,false,5000);assert.equal((await wallet(db,b)).paid_units,10);
  await assert.rejects(purchase(db,'bad',a,false,1000,0),/poster_invalid_input/);
  await db.exec('set role service_role');await purchase(db,'service-proof',a,true,1000);await db.exec('reset role');
 });
 await t.test('welcome gifts are bounded, one per account/identity, and Pro upgrades only add the difference',async()=>{
  const hash='a'.repeat(64);const claim=(user=a,pro=false,key=hash)=>db.query('select public.poster_claim_promotion($1,$2,$3)',[user,key,pro]);
  await assert.rejects(claim(),/poster_promotion_unavailable/);
  await db.exec('update public.poster_commerce_settings set promotion_enabled=true,promotion_max_units=12');
  await claim();await claim();assert.equal((await wallet(db)).bonus_units,3);
  await claim(a,true);await claim(a,true);assert.equal((await wallet(db)).bonus_units,9);
  await assert.rejects(claim(b,false),/poster_promotion_claimed/);
  await assert.rejects(claim(a,false,'c'.repeat(64)),/duplicate key/);
  await claim(b,false,'b'.repeat(64));await assert.rejects(claim(b,true,'b'.repeat(64)),/poster_promotion_unavailable/);
  assert.equal((await db.query('select promotion_awarded_units from public.poster_commerce_settings')).rows[0].promotion_awarded_units,12);
  await db.exec('update public.poster_commerce_settings set promotion_enabled=false');
 });
 await t.test('foreign sessions, parents and job ids cannot use another account or expose its poster',async()=>{
  await assert.rejects(reserve(db,1,a,sb),/poster_session_unavailable/);
  await db.exec('set role service_role');await reserve(db,1);await db.exec('reset role');await assert.rejects(reserve(db,1,b,sb),/poster_id_conflict/);
  await assert.rejects(reserve(db,2),/poster_busy/);
  await assert.rejects(db.query("insert into storage.objects values('poster-ai-private',$1)",[`${b}/${id(1)}.jpg`]),/poster_forbidden/);
  await db.query("insert into storage.objects values('poster-ai-private',$1)",[`${a}/${id(1)}.jpg`]);
  await db.exec('set role service_role');await finish(db,1);await finish(db,1);await db.exec('reset role');
  await assert.rejects(reserve(db,2,b,sb,id(1)),/poster_parent_unavailable/);
  assert.equal((await wallet(db)).bonus_units,7);assert.equal((await wallet(db)).paid_units,10);
  assert.equal((await db.query('select count(*)::integer as n from public.poster_test_wallets')).rows[0].n,1);
 });
 await t.test('refund after consumption creates debt and blocks spending, without losing prior outputs',async()=>{
  await db.exec(`update public.poster_wallets set bonus_units=0 where user_id='${a}'`); // Exhaust remaining promotional balance in this fixture.
  await reserve(db,3);await finish(db,3);assert.equal((await wallet(db)).paid_units,8);
  await purchase(db,'purchase-a',a,true,2000);assert.equal((await wallet(db)).paid_units,-2);
  await assert.rejects(reserve(db,4),/poster_credits_empty/);
  await purchase(db,'new-purchase');assert.equal((await wallet(db)).paid_units,8);
  assert.equal((await db.query('select status from public.poster_ai_jobs where id=$1',[id(3)])).rows[0].status,'complete');
 });
 await t.test('all accounts reserve against the same global 5 EUR cap, including in-flight calls',async()=>{
  const before=await budget(db);await db.exec('update public.poster_ai_budget set accounted_eur_cents=400');
  await reserve(db,4);await assert.rejects(reserve(db,5,b,sb),/poster_budget_exhausted/);
  assert.equal((await budget(db)).reserved_eur_cents,75);await finish(db,4,'failed',a,null,'poster_provider_rejected',true);
  assert.equal((await wallet(db)).reserved_paid_units,0);assert.equal((await wallet(db)).paid_units,8);
  await db.query('update public.poster_ai_budget set accounted_eur_cents=$1',[before.accounted_eur_cents]);
 });
 await t.test('unknown outcomes retain their wallet and provider reservation; no duplicate charge or retry',async()=>{
  await reserve(db,6);await finish(db,6,'uncertain',a,null,'poster_provider_uncertain');
  assert.equal((await wallet(db)).reserved_paid_units,2);assert.equal((await budget(db)).reserved_eur_cents,75);
  await assert.rejects(reserve(db,7),/poster_busy/);
  const duplicate=await reserve(db,6);assert.equal(duplicate.rows[0].result.created,false);
 });
 await t.test('client roles cannot grant, refund, change switches or read another wallet',async()=>{
  await db.exec('set role authenticated');await assert.rejects(purchase(db,'forged'),/permission denied/);
  await assert.rejects(db.query('select * from public.poster_wallets'),/permission denied/);
  await assert.rejects(db.exec('update public.poster_commerce_settings set public_enabled=true'),/permission denied/);
  await assert.rejects(reserve(db,8),/permission denied/);
  await db.exec('reset role');
 });
 await t.test('an explicitly invited App Review account can test Apple purchases without adding paid credits',async()=>{
  await assert.rejects(db.query('select public.poster_grant_sandbox_receipt($1,$2,$3)',[b,'sandbox',product]),/poster_forbidden/);
  await db.query("update public.poster_commerce_access set credit_mode='simulation' where user_id=$1",[b]);
  const paidBefore=(await wallet(db,b)).paid_units;
  await db.query('select public.poster_grant_sandbox_receipt($1,$2,$3)',[b,'sandbox',product]);
  await db.query('select public.poster_grant_sandbox_receipt($1,$2,$3)',[b,'sandbox',product]);
  assert.equal((await wallet(db,b)).paid_units,paidBefore);
  assert.equal((await db.query('select units from public.poster_test_wallets where user_id=$1',[b])).rows[0].units,10);
 });
 await t.test('a deleted account leaves a minimal transaction tombstone that prevents re-awarding the purchase',async()=>{
  await db.query('delete from auth.users where id=$1',[b]);
  await purchase(db,'refund-first',a,false,6000);assert.equal((await wallet(db)).paid_units,8);
  assert.equal((await db.query("select user_id from public.poster_store_transactions where transaction_id='refund-first'")).rows[0].user_id,null);
 });
 assert.equal((await budget(db)).limit_eur_cents,500);
 }finally{await db.close();}
});

test('public access opens the creator for confirmed accounts without granting credits or changing the provider ceiling',async()=>{
 const db=await setup();try{
  for(const name of ['20261023112033_poster_commerce_private.sql','20261023122510_poster_navigation_access.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+name,'utf8'));
  const before=await budget(db);
  const trialBefore=(await db.query('select units from public.poster_test_wallets where user_id=$1',[owner])).rows[0].units;
  // Same operational change as production: preserve the existing test identity, then open public access.
  await db.exec("insert into public.poster_commerce_access(user_id,enabled,credit_mode) select user_id,true,'simulation' from public.poster_ai_budget on conflict(user_id) do nothing;update public.poster_commerce_settings set public_enabled=true where id=true;");
  const allowed=async(user)=>{
   await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('set role authenticated');
   const result=(await db.query('select public.poster_feature_access() as allowed')).rows[0].allowed;await db.exec('reset role');return result;
  };
  assert.equal(await allowed(a),true);assert.equal(await allowed(b),true);assert.equal(await allowed(owner),true);
  const next='33333333-3333-4333-8333-333333333333';await db.query('insert into auth.users(id) values($1)',[next]);assert.equal(await allowed(next),true);
  await db.query('update auth.users set email_confirmed_at=null where id=$1',[b]);assert.equal(await allowed(b),false);
  await db.query('update auth.users set email_confirmed_at=now() where id=$1',[b]);
  await db.query('insert into public.poster_commerce_access(user_id,enabled) values($1,false)',[b]);assert.equal(await allowed(b),false);
  assert.equal(await allowed('44444444-4444-4444-8444-444444444444'),false);
  const modes=(await db.query('select poster_private.credit_mode($1) as owner,poster_private.credit_mode($2) as regular',[owner,a])).rows[0];assert.deepEqual(modes,{owner:'simulation',regular:'production'});
  await assert.rejects(reserve(db,100),/poster_credits_empty/);
  assert.deepEqual(await budget(db),before);
  assert.equal((await db.query('select units from public.poster_test_wallets where user_id=$1',[owner])).rows[0].units,trialBefore);
  assert.equal((await db.query('select count(*)::int n from public.poster_wallets')).rows[0].n,0);
  const flags=(await db.query('select public_enabled,purchases_enabled,promotion_enabled,promotion_max_units from public.poster_commerce_settings')).rows[0];
  assert.deepEqual(flags,{public_enabled:true,purchases_enabled:false,promotion_enabled:false,promotion_max_units:0});
  await db.exec('set role anon');await assert.rejects(db.query('select public.poster_feature_access()'),/permission denied/);await db.exec('reset role');
 }finally{await db.close();}
});

test('welcome launch grants 3 Free / 5 Pro credits once and enforces the shared 250 EUR budget',async t=>{
 const db=await setup();try{
  for(const name of ['20261023112033_poster_commerce_private.sql','20261023122510_poster_navigation_access.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+name,'utf8'));
  const claim=(user=a,pro=false,key='a'.repeat(64))=>db.query('select public.poster_claim_promotion($1,$2,$3)',[user,key,pro]);
  await db.exec(`insert into public.poster_commerce_access(user_id,enabled) values('${a}',true);update public.poster_commerce_settings set promotion_enabled=true,promotion_max_units=12;`);
  await purchase(db,'existing-paid');await claim(); // Prior 1.5-credit gift must be topped up, never replaced.
  const before=await budget(db);
  await db.exec(fs.readFileSync('supabase/migrations/20261027221952_poster_welcome_launch.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20261027223843_poster_automatic_welcome_credits.sql','utf8'));
  await t.test('launch preserves spend, reservations, paid and owner test balances',async()=>{
   assert.deepEqual(await budget(db),{...before,limit_eur_cents:25000});
   assert.equal((await wallet(db)).paid_units,10);assert.equal((await wallet(db)).bonus_units,3);
   assert.equal((await db.query('select units from public.poster_test_wallets where user_id=$1',[owner])).rows[0].units,18);
   assert.equal((await db.query('select poster_private.credit_mode($1) as mode',[owner])).rows[0].mode,'simulation');
   const settings=(await db.query('select * from public.poster_commerce_settings')).rows[0];
   assert.equal(settings.public_enabled,true);assert.equal(settings.promotion_enabled,true);assert.equal(settings.purchases_enabled,false);assert.equal(settings.promotion_max_units,2000);
  });
  await t.test('Free claims top up to 3; Pro adds only 2 more; duplicates never refill spent credits',async()=>{
   await claim();await claim();assert.equal((await wallet(db)).bonus_units,6);
   await claim(a,true);await claim(a,true);assert.equal((await wallet(db)).bonus_units,10);
   await db.query('update public.poster_wallets set bonus_units=8 where user_id=$1',[a]);await claim(a,true);assert.equal((await wallet(db)).bonus_units,8);
   await assert.rejects(claim(b,false),/poster_promotion_claimed/);
   await claim(b,true,'b'.repeat(64));assert.equal((await wallet(db,b)).bonus_units,10);
   const ledger=(await db.query("select sum(bonus_units)::int as units from public.poster_credit_ledger where user_id=$1 and kind='promotion'",[a])).rows[0];assert.equal(ledger.units,10);
  });
  await t.test('new accounts are eligible and promotion pool exhaustion does not partially award',async()=>{
   const next=id(700);await db.query('insert into auth.users(id) values($1)',[next]);await claim(next,false,'c'.repeat(64));assert.equal((await wallet(db,next)).bonus_units,6);
   const settings=(await db.query('select promotion_awarded_units from public.poster_commerce_settings')).rows[0];
   await db.query('update public.poster_commerce_settings set promotion_max_units=$1',[settings.promotion_awarded_units+3]);
   await assert.rejects(claim(next,true,'c'.repeat(64)),/poster_promotion_unavailable/);assert.equal((await wallet(db,next)).bonus_units,6);
   await db.exec('update public.poster_commerce_settings set promotion_max_units=2000');
  });
  await t.test('more than 5 EUR can be reserved across accounts and the 250 EUR cap includes in-flight calls',async()=>{
   for(let n=0;n<8;n++){
    const user=id(800+n),session=id(900+n);await db.query('insert into auth.users(id) values($1)',[user]);
    await db.query("insert into public.sessions values($1,$2,'2099-12-24','23:30','confirmed','Europe/Madrid')",[session,user]);
    await claim(user,false,String(n).repeat(64));await reserve(db,1000+n,user,session);
   }
   assert.equal((await budget(db)).reserved_eur_cents,600);
   await db.exec('update public.poster_ai_budget set accounted_eur_cents=24400');
   await assert.rejects(reserve(db,1100),/poster_budget_exhausted/);
   for(let n=0;n<8;n++)await finish(db,1000+n,'failed',id(800+n),null,'poster_provider_rejected',true);
   assert.equal((await budget(db)).reserved_eur_cents,0);
   await db.exec('update public.poster_ai_budget set accounted_eur_cents=24925');
   await reserve(db,1100);await assert.rejects(reserve(db,1101,b,sb),/poster_budget_exhausted/);
   await finish(db,1100,'failed',a,null,'poster_provider_rejected',true);
   await assert.rejects(db.exec('update public.poster_ai_budget set limit_eur_cents=25001'),/check constraint/);
  });
  await t.test('public clients cannot grant credits or change the campaign or ceiling',async()=>{
   for(const role of ['authenticated','anon']){
    await db.exec('set role '+role);await assert.rejects(claim(),/permission denied/);
    await assert.rejects(db.exec('update public.poster_ai_budget set limit_eur_cents=25000'),/permission denied/);
    await assert.rejects(db.exec('update public.poster_commerce_settings set promotion_max_units=999999'),/permission denied/);await db.exec('reset role');
   }
  });
 }finally{await db.close();}
});


test('welcome Pro access matches the app, tops up existing trials once and preserves all spending',async()=>{
 const db=await setup();try{
  await db.exec(`create schema billing_private;create table billing_private.pro_trials(user_id uuid primary key,started_at timestamptz default now(),expires_at timestamptz);create table billing_private.subscription_access(user_id uuid primary key,pro_until timestamptz,checked_at timestamptz);grant usage on schema billing_private to service_role;grant select on billing_private.pro_trials,billing_private.subscription_access to service_role;`);
  for(const name of ['20261023112033_poster_commerce_private.sql','20261023122510_poster_navigation_access.sql','20261027221952_poster_welcome_launch.sql','20261027223843_poster_automatic_welcome_credits.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+name,'utf8'));
  const claim=(user=a,pro=false,hash='a'.repeat(64))=>db.query('select public.poster_claim_promotion($1,$2,$3)',[user,hash,pro]);
  await claim();await purchase(db,'prior-purchase');await db.query('update public.poster_wallets set bonus_units=bonus_units-2 where user_id=$1',[a]);
  await db.query("insert into billing_private.pro_trials(user_id,expires_at) values($1,now()+interval '7 days'),($2,now()-interval '1 day')",[a,b]);
  const previous=await budget(db);
  const migration=fs.readFileSync('supabase/migrations/20261027225945_poster_pro_welcome_consistency.sql','utf8');await db.exec(migration);
  assert.equal((await wallet(db)).bonus_units,8); // Received 3, spent 1, added 2 = 4 available.
  assert.equal((await wallet(db)).paid_units,10);assert.deepEqual(await budget(db),previous);
  assert.equal((await db.query('select units from public.poster_promotion_claims where user_id=$1',[a])).rows[0].units,10);
  await db.exec('set role service_role');await claim();assert.equal((await db.query('select public.poster_account_status($1) as s',[a])).rows[0].s.proActive,true);await db.exec('reset role');
  await db.exec(migration);assert.equal((await wallet(db)).bonus_units,8); // Retry of backfill never refills spent credits.
  await claim(b,false,'b'.repeat(64));assert.equal((await wallet(db,b)).bonus_units,6);assert.equal((await db.query('select public.poster_account_status($1) as s',[b])).rows[0].s.proActive,false);
  await db.query("update billing_private.pro_trials set expires_at=now()+interval '7 days' where user_id=$1",[b]);await claim(b,false,'b'.repeat(64));assert.equal((await wallet(db,b)).bonus_units,10);
  await db.query("update billing_private.pro_trials set expires_at=now()-interval '1 day' where user_id=$1",[b]);await claim(b,false,'b'.repeat(64));assert.equal((await wallet(db,b)).bonus_units,10);
  await db.exec('set role authenticated');await assert.rejects(db.query('select public.poster_account_status($1)',[a]),/permission denied/);await assert.rejects(claim(),/permission denied/);await db.exec('reset role');
 }finally{await db.close();}
});
