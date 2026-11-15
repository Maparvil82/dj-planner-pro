const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
test('privileged backend: owner-only snapshot, active accounts, unprivileged public wrappers and isolated intro',async()=>{
 const db=new PGlite(),owner='d5d17646-f273-4fda-b094-ea8a97cb3ad1',other='00000000-0000-0000-0000-000000000002';
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema account_private;create schema poster_private;create schema billing_private;
 create table auth.users(id uuid primary key,active boolean default true);create table billing_private.pro_trials(user_id uuid,started_at timestamptz,expires_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function account_private.active_user(id uuid) returns boolean language sql security definer set search_path='' as $$select coalesce((select active from auth.users where users.id=$1),false)$$;
 revoke all on function account_private.active_user(uuid) from public;
 grant usage on schema auth,account_private,poster_private to authenticated;
 insert into auth.users(id) values('${owner}'),('${other}');`);
 await db.exec(fs.readFileSync('supabase/migrations/20261028133737_poster_intro_once.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261017010421_admin_dashboard_snapshot.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261028154756_backend_privileged_boundaries.sql','utf8'));
 const as=async(id,sql,role='authenticated')=>{await db.exec(`reset role;select set_config('request.jwt.claim.sub','${id}',false);set role ${role}`);return db.query(sql)};
 for(const fn of ['public.admin_dashboard_snapshot()','account_private.admin_dashboard_snapshot()','public.complete_poster_intro()','poster_private.complete_intro()'])await assert.rejects(as('',`select ${fn}`,'anon'),/permission denied/);
 for(const fn of ['public.admin_dashboard_snapshot()','account_private.admin_dashboard_snapshot()'])await assert.rejects(as(other,`select ${fn}`),/Forbidden/);
 const snapshot=(await as(owner,'select public.admin_dashboard_snapshot() result')).rows[0].result;assert.equal(snapshot.registered,2);assert.deepEqual(snapshot.userIds.sort(),[owner,other].sort());
 await as(other,'select public.complete_poster_intro()');await as(other,'select public.complete_poster_intro()');assert.equal((await as(other,'select count(*) n from poster_private.intro_completions')).rows[0].n,1);
 assert.equal((await as(owner,'select public.poster_intro_seen() seen')).rows[0].seen,false);
 await assert.rejects(as(other,`insert into poster_private.intro_completions(user_id) values('${owner}')`),/permission denied/);
 await assert.rejects(as(other,`select * from auth.users`),/permission denied/);
 await db.exec(`reset role;update auth.users set active=false`);
 await assert.rejects(as(owner,'select public.admin_dashboard_snapshot()'),/Forbidden/);await assert.rejects(as(other,'select public.complete_poster_intro()'),/insufficient_privilege/);
 await db.exec(`reset role;delete from auth.users where id='${owner}'`);await assert.rejects(as(owner,'select public.admin_dashboard_snapshot()'),/Forbidden/);
 await db.exec('reset role');const flags=(await db.query(`select proname,prosecdef from pg_proc where oid in ('public.admin_dashboard_snapshot()'::regprocedure,'public.complete_poster_intro()'::regprocedure)`)).rows;assert(flags.every(r=>r.prosecdef===false));
 }finally{await db.close()}
});
