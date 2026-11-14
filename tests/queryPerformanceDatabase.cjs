const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs'), assert = require('node:assert/strict');
const db = new PGlite();
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const policies = [
 ['users_profile',[['Users can view own profile','SELECT'],['Users can view their own profile','SELECT'],['Users can insert own profile','INSERT'],['Users can insert their own profile','INSERT'],['Users can update own profile','UPDATE'],['Users can update their own profile','UPDATE']],'id'],
 ['sessions',[['Users can view own sessions','SELECT'],['Users can insert own sessions','INSERT'],['Users can update own sessions','UPDATE'],['Users can delete own sessions','DELETE']],'user_id'],
 ['user_tags',[['Users can view their own tags.','SELECT'],['Users can insert their own tags.','INSERT'],['Users can update their own tags.','UPDATE'],['Users can delete their own tags.','DELETE']],'user_id'],
 ['venues',[['Users can manage their own venues','ALL']],'user_id'],
 ['vault_files',[['Users can manage their own files','ALL']],'user_id'],
 ['vault_folders',[['Users can manage their own folders','ALL']],'user_id'],
];
async function as(user,role='authenticated') {
 await db.exec('reset role');
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user ? uid(user):'']);
 await db.exec(`set role ${role}`);
}
const sql = `select id,date from public.sessions where user_id='${uid(1)}' and date>='2027-01-01' and date<'2027-02-01' order by date,id limit 20`;
async function plan() { return (await db.query('explain (analyze,format json) '+sql)).rows[0]['QUERY PLAN'][0]; }
(async()=>{
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema community_private;create schema booking_private;grant usage on schema auth,community_private to authenticated;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table users_profile(id uuid primary key,artist_name text);
 create table sessions(id uuid primary key default gen_random_uuid(), user_id uuid,date date,title text,venue text,venue_city text,venue_city_location jsonb,venue_address text,booking_timezone text,start_time text,end_time text,color text,status text,poster_url text,poster_focus_x float8,poster_focus_y float8,currency text,created_at timestamptz,updated_at timestamptz,parent_session_id uuid);
 create table venues(id uuid primary key,user_id uuid);create table user_tags(id uuid primary key,user_id uuid);
 create table vault_files(id uuid primary key,user_id uuid,folder_id uuid);create table vault_folders(id uuid primary key,user_id uuid);
 create table community_private.reports(id uuid primary key,author_id uuid,reviewed_by uuid);
 create table community_private.removed_content(id uuid primary key,report_id uuid);
 create table community_private.review_log(id uuid primary key,report_id uuid,moderator_id uuid);
 create table booking_private.email_outbox(id uuid primary key,request_id uuid);
 create table session_collaborators(session_id uuid,dj_id uuid,inviter_id uuid,status text);
 create index idx_sessions_user_id on sessions(user_id);create index idx_sessions_date on sessions(date);
 insert into users_profile values('${uid(1)}','Viewer'),('${uid(2)}','Other');
 insert into sessions(id,user_id,date,status) values('${uid(10)}','${uid(2)}','2027-01-15','confirmed'),('${uid(11)}','${uid(2)}','2027-03-01','confirmed'),('${uid(12)}','${uid(2)}','2027-01-16','confirmed');
 insert into session_collaborators values('${uid(10)}','${uid(1)}','${uid(2)}','accepted'),('${uid(11)}','${uid(1)}','${uid(2)}','accepted'),('${uid(12)}','${uid(1)}','${uid(2)}','invited'),('${uid(10)}','${uid(3)}','${uid(4)}','accepted');
 insert into sessions(user_id,date,status) select ('00000000-0000-4000-8000-'||lpad(((n % 100)+1)::text,12,'0'))::uuid,date '2026-01-01'+(n % 730),'confirmed' from generate_series(1,100000) n;`);
 for(const [table,rules,col] of policies){
  await db.exec(`alter table ${table} enable row level security;grant select,insert,update,delete on ${table} to authenticated,anon;`);
  for(const [name,cmd] of rules){
   let q=`create policy "${name}" on ${table} for ${cmd} to public`;
   if(cmd!=='INSERT')q+=` using(auth.uid()=${col})`;
   if(cmd==='INSERT'||cmd==='ALL')q+=` with check(auth.uid()=${col})`;
   await db.exec(q);
  }
 }
 await db.exec('analyze sessions');await as(1); const before=await plan();
 const beforeRows=(await db.query(sql)).rows;
 await db.exec('reset role');await db.exec(fs.readFileSync('supabase/migrations/20261010090326_query_performance.sql','utf8'));
 await as(1);const after=await plan();assert.deepEqual((await db.query(sql)).rows,beforeRows);
 assert.match(JSON.stringify(after),/sessions_owner_date_idx/);
 assert.match(JSON.stringify(after),/InitPlan/);
 assert.equal((await db.query('select count(*)::int n from users_profile')).rows[0].n,1);
 await assert.rejects(db.query(`insert into user_tags values('${uid(19)}','${uid(2)}')`));
 await assert.rejects(db.query(`update users_profile set id='${uid(5)}' where id='${uid(1)}'`));
 await db.query(`insert into user_tags values('${uid(19)}','${uid(1)}')`);
 const agenda=(await db.query("select * from session_agenda_range('2027-01-01','2027-02-01',0)")).rows.map(r=>r.session_agenda_range);
 assert.equal(agenda.length,1); assert.equal(agenda[0].id,uid(10));assert.equal(agenda[0].earning_amount,0);assert.equal(agenda[0].is_guest,true);
 assert.equal((await db.query('select * from session_agenda_range(null,null,0)')).rows.length,2);
 await as(3);assert.equal((await db.query('select * from session_agenda_range(null,null,0)')).rows.length,0);
 await as(null,'anon');assert.equal((await db.query('select count(*)::int n from sessions')).rows[0].n,0);
 await assert.rejects(db.query('select * from session_agenda_range(null,null,0)'));
 await db.exec('reset role');
 assert.equal((await db.query("select count(*)::int n from pg_policies where tablename='users_profile'")).rows[0].n,3);
 console.log(JSON.stringify({fixture_sessions:100003,before_ms:before['Execution Time'],after_ms:after['Execution Time'],before_plan:before.Plan['Node Type'],after_index:'sessions_owner_date_idx'}));
 console.log('PASS: same rows and ownership, no reassignment or anonymous access, guest date bounds/status/identity/private fields, composite index and cached auth plan on 100k sessions.');
 await db.close();
})().catch(async e=>{console.error(e);await db.close();process.exitCode=1});
