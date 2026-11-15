const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs'), assert=require('node:assert/strict');
const db=new PGlite();
const a='00000000-0000-4000-8000-000000000991', b='00000000-0000-4000-8000-000000000992';
const answers={profile:'self_employed',frequency:'one_two',tools:['calendar'],time:'one_three',priorities:['payments_due'],first:'payments_due'};
(async()=>{
 await db.exec(`create role authenticated; create role anon; create role service_role; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated; insert into auth.users values('${a}'),('${b}');`);
 await db.exec(fs.readFileSync('supabase/migrations/20261103181306_research_survey_responses.sql','utf8'));
 async function role(user){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('set role authenticated');}
 await role(a);
 async function insert(user,payload=answers){return db.query("insert into public.research_survey_responses(user_id,survey_version,language,answers) values($1,'self-employed-djs-v1','es',$2)",[user,JSON.stringify(payload)]);}
 await assert.rejects(insert(b),e=>e.code==='42501');
 for(const payload of [{...answers,profile:'wrong'},{...answers,priorities:['none','payments_due']},{...answers,first:'invoices'},{...answers,priorities:['payments_due','invoices','quotes_contracts','cash_forecast']},{...answers,tools:['calendar','calendar']},{...answers,additional:'a'.repeat(1501)},{...answers,frequency:'none',recent:'hidden'}])await assert.rejects(insert(a,payload),e=>e.code==='23514');
 await insert(a);assert.equal((await db.query('select * from public.research_survey_responses')).rows.length,1);
 await assert.rejects(insert(a),e=>e.code==='23505');
 await assert.rejects(db.exec('update public.research_survey_responses set language=\'en\''),e=>e.code==='42501');
 await assert.rejects(db.exec('delete from public.research_survey_responses'),e=>e.code==='42501');
 await role(b);assert.equal((await db.query('select * from public.research_survey_responses')).rows.length,0);
 await insert(b,{...answers,priorities:['none'],first:undefined});
 await db.exec('reset role; set role anon');
 await assert.rejects(db.exec('select * from public.research_survey_responses'),e=>e.code==='42501');
 await db.close();console.log('PASS: survey schema, payload validation, own-account access, duplicate protection and denied anonymous/update/delete access.');
})().catch(async e=>{console.error(e);await db.close();process.exit(1);});
