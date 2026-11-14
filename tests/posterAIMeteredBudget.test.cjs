const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const {PGlite}=require('@electric-sql/pglite');
const owner='d5d17646-f273-4fda-b094-ea8a97cb3ad1',session='12345678-1234-4234-8234-123456789012';
const job=i=>`${i.toString(16).padStart(8,'0')}-1234-4234-8234-123456789012`;
const usage={input_tokens:1784,output_tokens:5488,input_tokens_details:{text_tokens:312,image_tokens:1472}};
async function setup(){const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create schema account_private;create table auth.users(id uuid primary key);create table public.sessions(id uuid primary key,user_id uuid,date date,start_time text,status text,booking_timezone text);create table storage.objects(bucket_id text,name text);create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create function account_private.active_user(target uuid) returns boolean language sql security definer as 'select exists(select 1 from auth.users where id=target)';create function account_private.work(text,uuid) returns jsonb language sql as 'select null::jsonb';create function account_private.finalize_guard() returns trigger language plpgsql as 'begin return old; end';grant usage on schema account_private to service_role;grant select on public.sessions to service_role;insert into auth.users values('${owner}');insert into public.sessions values('${session}','${owner}','2099-12-24','23:30','confirmed','Europe/Madrid');`);await db.exec(fs.readFileSync('supabase/migrations/20261018235804_poster_ai_private_beta.sql','utf8'));await db.exec('update public.poster_ai_budget set enabled=true');return db;}
const reserve=(db,id)=>db.query('select public.reserve_poster_ai_job($1,$2,$3,null,$4,$5,null) as result',[id,owner,session,'hash',JSON.stringify({title:'Test',djs:['DJ'],format:'Cartel'})]);
const finish=(db,id,status='complete',u=usage,error=null,noCharge=false)=>db.query('select public.settle_poster_ai_job($1,$2,$3,$4,$5,null,$6)',[id,status,u,status==='complete'?`${owner}/${id}.jpg`:null,error,noCharge]);
const balance=async db=>(await db.query('select * from public.poster_ai_budget')).rows[0];
test('metered budget migrates historical usage, permits more than two operations and blocks at the same 5 EUR ceiling',async t=>{
 const db=await setup();try{
 await reserve(db,job(1));await db.query("update public.poster_ai_jobs set status='complete',usage=$1,output_path='saved.jpg' where id=$2",[usage,job(1)]);
 await reserve(db,job(2));await db.query("update public.poster_ai_jobs set status='complete',usage=$1,output_path='saved2.jpg' where id=$2",[usage,job(2)]);
 await db.exec(fs.readFileSync('supabase/migrations/20261019012700_poster_ai_metered_budget.sql','utf8'));
 let b=await balance(db);assert.equal(b.limit_eur_cents,500);assert.equal(b.accounted_eur_cents,90);assert.equal(b.reserved_eur_cents,0);
 await t.test('billing helper rejects missing or malformed usage',async()=>{const {rows}=await db.query("select poster_private.usage_eur_cents(null) as missing,poster_private.usage_eur_cents('{\"output_tokens\":-100}') as invalid");assert.equal(rows[0].missing,null);assert.equal(rows[0].invalid,null);});
 await t.test('service role can reserve and settle, repeated settlement does not spend twice',async()=>{await db.exec('set role service_role');await reserve(db,job(3));assert.equal((await balance(db)).reserved_eur_cents,100);await finish(db,job(3));const before=await balance(db);await finish(db,job(3));assert.deepEqual(await balance(db),before);await db.exec('reset role');});
 await t.test('a confirmed quota rejection refunds its temporary reserve',async()=>{await reserve(db,job(4));const before=await balance(db);await finish(db,job(4),'failed',null,'poster_provider_quota',true);const after=await balance(db);assert.equal(after.accounted_eur_cents,before.accounted_eur_cents);assert.equal(after.reserved_eur_cents,0);});
 await t.test('concurrent calls and ambiguous provider outcomes stay blocked',async()=>{await reserve(db,job(5));await assert.rejects(reserve(db,job(6)),/poster_busy/);await finish(db,job(5),'uncertain',null,'poster_provider_uncertain');assert.equal((await balance(db)).reserved_eur_cents,100);await assert.rejects(reserve(db,job(6)),/poster_busy/);
 // Test-only manual reconciliation after confirmed rejection.
 await db.exec("update public.poster_ai_jobs set status='running' where id='"+job(5)+"'");await finish(db,job(5),'failed',null,'poster_provider_quota',true);});
 await t.test('many completed operations remain available until the funds, rather than count, run out',async()=>{for(let i=6;i<=11;i++){await reserve(db,job(i));await finish(db,job(i));}const b=await balance(db);assert.equal(b.accounted_eur_cents,405);assert.equal(b.reserved_eur_cents,0);assert.ok(b.attempts>2);await assert.rejects(reserve(db,job(12)),/poster_budget_exhausted/);assert.equal((await balance(db)).limit_eur_cents,500);});
 await t.test('clients cannot call settlement to refund or change their budget',async()=>{await db.exec('set role authenticated');await assert.rejects(finish(db,job(3)),/permission denied/);await db.exec('reset role');});
 await t.test('calibration preserves historical usage and the five-euro cap while unlocking affordable trials',async()=>{
 const original=await db.query('select usage from public.poster_ai_jobs where id=$1',[job(3)]);
 await db.exec(fs.readFileSync('supabase/migrations/20261019032802_poster_ai_calibrated_budget.sql','utf8'));
 let b=await balance(db);assert.equal(b.limit_eur_cents,500);assert.equal(b.accounted_eur_cents,207);assert.equal(b.reserved_eur_cents,0);
 assert.deepEqual((await db.query('select usage from public.poster_ai_jobs where id=$1',[job(3)])).rows,original.rows);
 await reserve(db,job(12));assert.equal((await balance(db)).reserved_eur_cents,75);
 await finish(db,job(12));b=await balance(db);assert.equal(b.accounted_eur_cents,230);assert.equal(b.reserved_eur_cents,0);
 for(let i=13;i<=21;i++){await reserve(db,job(i));await finish(db,job(i));}
 await assert.rejects(reserve(db,job(22)),/poster_budget_exhausted/);assert.equal((await balance(db)).limit_eur_cents,500);
 });
 await t.test('Google usage has separate rates, includes thought tokens, rejects unknown models and preserves historical costs and ceiling',async()=>{
 const before=await balance(db);
 const oldUsage=await db.query('select usage,accounted_eur_cents from public.poster_ai_jobs where id=$1',[job(3)]);
 const file=fs.readdirSync('supabase/migrations').find(f=>f.endsWith('_poster_google_metering.sql'));
 await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
 assert.deepEqual(await balance(db),before);
 assert.deepEqual((await db.query('select usage,accounted_eur_cents from public.poster_ai_jobs where id=$1',[job(3)])).rows,oldUsage.rows);
 const google={_provider:'vertex',_model:'gemini-3.1-flash-image',usageMetadata:{promptTokenCount:4000,totalTokenCount:5500,candidatesTokenCount:1120,thoughtsTokenCount:380}};
 const cost=async u=>(await db.query('select poster_private.usage_eur_cents($1) as n',[u])).rows[0].n;
 assert.equal(await cost(google),12); // Includes 380 thought tokens at the conservative image rate.
 assert.equal(await cost({...google,usageMetadata:{...google.usageMetadata,totalTokenCount:5120}}),12); // Never undercount sum of output + thoughts.
 for(const bad of [{...google,_model:'unknown'}, {...google,usageMetadata:{promptTokenCount:100,totalTokenCount:50}},
  {...google,usageMetadata:null},{...google,usageMetadata:{promptTokenCount:100,totalTokenCount:200,thoughtsTokenCount:-1}},
  {...usage,_provider:'unknown'}])assert.equal(await cost(bad),null);
 assert.equal(await cost(usage),23);
 await db.exec('set role authenticated');await assert.rejects(cost(google),/permission denied/);await db.exec('reset role');
 });
 }finally{await db.close();}
});
