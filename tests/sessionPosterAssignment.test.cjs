const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const {PGlite}=require('@electric-sql/pglite');
const user='d5d17646-f273-4fda-b094-ea8a97cb3ad1',other='22222222-2222-4222-8222-222222222222',session='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const id=n=>`${String(n).padStart(8,'0')}-1234-4234-8234-123456789012`;
test('session assignment is atomic, confirmed, owned, idempotent and survives client closure',async t=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create schema account_private;
 create table auth.users(id uuid primary key);insert into auth.users values('${user}'),('${other}');
 create function auth.uid() returns uuid language sql as $$select '${user}'::uuid$$;
 create function account_private.active_user(target uuid) returns boolean language sql as $$select exists(select 1 from auth.users where id=target)$$;
 create function account_private.work(text,uuid) returns jsonb language sql as 'select null::jsonb';
 create function account_private.finalize_guard() returns trigger language plpgsql as 'begin return old; end';
 create table public.sessions(id uuid primary key,user_id uuid,date date,start_time text,status text,booking_timezone text,poster_url text,poster_focus_x float8 default .5,poster_focus_y float8 default .5);
 insert into public.sessions(id,user_id,date,start_time,status,booking_timezone) values('${session}','${user}','2099-12-24','23:30','confirmed','Europe/Madrid');
 create table storage.objects(bucket_id text,name text);create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 grant usage on schema account_private,auth to service_role;grant select on auth.users to service_role;grant select,update on public.sessions to service_role;`);
 for(const name of ['20261018235804_poster_ai_private_beta.sql','20261019012700_poster_ai_metered_budget.sql','20261019032802_poster_ai_calibrated_budget.sql','20261021013422_poster_test_credit_wallet.sql','20261021122711_poster_apple_sandbox_receipts.sql','20261022224311_poster_google_metering.sql','20261024120000_session_generated_posters.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+name,'utf8'));
 await db.exec(`update public.poster_ai_budget set enabled=true,limit_eur_cents=500;insert into public.poster_test_wallets(user_id,units) values('${user}',100);set role service_role;`);
 const reserve=(n,expected=null,targetUser=user)=>db.query('select public.reserve_session_poster_job($1,$2,$3,null,$4,$5,null,$6) as result',[id(n),targetUser,session,'hash-'+n,{title:'Session',format:'Cartel'},expected]);
 const poster=async()=>(await db.query('select poster_url from public.sessions')).rows[0].poster_url;
 const complete=async(n)=>{await db.query('update public.poster_ai_jobs set session_poster_url=$2 where id=$1',[id(n),'https://example.test/sessions/poster-'+n+'.jpg']);await db.query("select public.settle_poster_ai_job($1,'complete',null,'output.jpg',null,null,false)",[id(n)]);};
 await t.test('no existing poster: complete assigns without any client update',async()=>{await reserve(1);assert.equal(await poster(),null);await complete(1);assert.match(await poster(),/poster-1/);assert.equal((await db.query('select session_poster_applied from public.poster_ai_jobs where id=$1',[id(1)])).rows[0].session_poster_applied,true);});
 await t.test('existing poster needs its exact confirmed snapshot before spending credits',async()=>{const before=(await db.query('select units from public.poster_test_wallets')).rows[0].units;await assert.rejects(reserve(2),/poster_session_poster_changed/);assert.equal((await db.query('select units from public.poster_test_wallets')).rows[0].units,before);const current=await poster();await reserve(2,current);assert.equal(await poster(),current);await complete(2);assert.match(await poster(),/poster-2/);});
 await t.test('retry after completion does not reserve again or overwrite a newer manual poster',async()=>{await db.exec("update public.sessions set poster_url='https://example.test/manual.jpg'");assert.equal((await reserve(2,'https://example.test/sessions/poster-1.jpg')).rows[0].result.created,false);await complete(2);assert.match(await poster(),/manual/);});
 await t.test('a manual change during generation wins; completed output remains saved',async()=>{await reserve(3,await poster());await db.exec("update public.sessions set poster_url='https://example.test/new-manual.jpg'");await complete(3);assert.match(await poster(),/new-manual/);const row=(await db.query('select status,session_poster_applied from public.poster_ai_jobs where id=$1',[id(3)])).rows[0];assert.deepEqual(row,{status:'complete',session_poster_applied:false});});
 await t.test('failed generation keeps previous poster',async()=>{await reserve(4,await poster());await db.query("select public.settle_poster_ai_job($1,'failed',null,null,'poster_provider_key',null,true)",[id(4)]);assert.match(await poster(),/new-manual/);});
 await t.test('foreign session and unprivileged caller cannot reserve',async()=>{await assert.rejects(reserve(5,await poster(),other),/poster_session_unavailable/);await db.exec('reset role;set role authenticated');await assert.rejects(reserve(5),/permission denied/);});
 }finally{await db.close();}
});
