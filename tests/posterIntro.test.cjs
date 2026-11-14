const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
test('poster introduction persists once per account, isolates accounts and rejects anonymous completion',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema poster_private;create schema account_private;
 create table auth.users(id uuid primary key,active boolean default true);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function account_private.active_user(id uuid) returns boolean language sql security definer as $$select coalesce((select active from auth.users where users.id=$1),false)$$;
 revoke all on function account_private.active_user(uuid) from public;
 grant usage on schema auth,poster_private to authenticated;
 insert into auth.users(id) values('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');`);
 await db.exec(fs.readFileSync('supabase/migrations/20261028133737_poster_intro_once.sql','utf8'));
 const asUser=async(id,sql)=>{await db.exec(`reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`);return db.query(sql)};
 const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
 assert.equal((await asUser(a,'select public.poster_intro_seen() seen')).rows[0].seen,false);
 await asUser(a,'select public.complete_poster_intro()');await asUser(a,'select public.complete_poster_intro()');
 assert.equal((await asUser(a,'select public.poster_intro_seen() seen')).rows[0].seen,true);
 assert.equal((await asUser(b,'select public.poster_intro_seen() seen')).rows[0].seen,false);
 assert.equal((await asUser(b,'select * from poster_private.intro_completions')).rows.length,0);
 await assert.rejects(asUser(b,`insert into poster_private.intro_completions(user_id) values('${b}')`),/permission denied/);
 await db.exec('reset role;set role anon');await assert.rejects(db.query('select public.complete_poster_intro()'),/permission denied/);
 await db.exec(`reset role;update auth.users set active=false where id='${b}'`);await assert.rejects(asUser(b,'select public.complete_poster_intro()'),/insufficient_privilege/);
 await db.exec(`reset role;delete from auth.users where id='${a}'`);assert.equal((await db.query('select * from poster_private.intro_completions')).rows.length,0);
 }finally{await db.close()}
});
