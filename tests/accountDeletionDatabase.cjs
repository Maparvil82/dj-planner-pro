const {PGlite}=require('@electric-sql/pglite');const fs=require('node:fs');const assert=require('node:assert/strict');
const db=new PGlite();const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function role(n,r='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[n?id(n):'']);await db.exec(`set role ${r}`);}
async function work(action,n){return(await db.query('select public.account_deletion_work($1,$2) x',[action,id(n)])).rows[0].x;}
(async()=>{
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create schema community_private;
create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table public.users_profile(id uuid primary key references auth.users on delete cascade);
create table public.user_tags(id uuid primary key,user_id uuid constraint user_tags_user_id_fkey references auth.users);
create table public.sessions(id uuid primary key,user_id uuid references public.users_profile on delete cascade,parent_session_id uuid constraint sessions_parent_session_id_fkey references public.sessions);
create table public.expenses(id uuid primary key,user_id uuid references auth.users on delete cascade,session_id uuid references public.sessions on delete set null);
create table public.session_tasks(id uuid primary key,user_id uuid references auth.users on delete cascade,session_id uuid references public.sessions on delete cascade);
create table public.vault_files(id uuid primary key,user_id uuid references auth.users on delete cascade);
create table public.community_profiles(user_id uuid primary key references auth.users on delete cascade);
create table community_private.moderators(user_id uuid primary key references auth.users on delete cascade);
create table community_private.reports(id uuid primary key,author_id uuid references auth.users on delete set null,reporter_id uuid references auth.users on delete set null,snapshot jsonb,details text);
create table storage.objects(bucket_id text,name text,owner_id text);
create function public.delete_user_data() returns void language sql security definer as $$delete from auth.users where id=auth.uid()$$;
grant usage on schema auth,storage to authenticated;grant select,insert,update on public.users_profile,public.sessions,storage.objects to authenticated;
insert into auth.users values('${id(1)}'),('${id(2)}');insert into public.users_profile values('${id(1)}'),('${id(2)}');
insert into public.user_tags values('${id(10)}','${id(1)}');insert into public.sessions values('${id(20)}','${id(1)}',null),('${id(21)}','${id(1)}','${id(20)}'),('${id(22)}','${id(2)}','${id(20)}');
insert into public.expenses values('${id(30)}','${id(1)}','${id(20)}');insert into public.session_tasks values('${id(31)}','${id(1)}','${id(20)}');insert into public.vault_files values('${id(32)}','${id(1)}');insert into public.community_profiles values('${id(1)}'),('${id(2)}');insert into community_private.moderators values('${id(1)}');
insert into community_private.reports values('${id(40)}','${id(1)}','${id(2)}','{"name":"Private Name","avatar_url":"private"}','reported'),('${id(41)}','${id(2)}','${id(1)}','{}','personal details');
insert into storage.objects values('avatars','${id(1)}/avatar.jpg','${id(1)}'),('sessions','${id(1)}/old-orphan.jpg',null),('vault','${id(1)}/nested/document.pdf','${id(1)}'),('expense-receipts','${id(1)}/receipt.jpg','${id(1)}'),('venues','${id(1)}/place.jpg','${id(1)}'),('avatars','${id(2)}/other.jpg','${id(2)}');`);
await db.exec(fs.readFileSync('supabase/migrations/20261009171214_complete_account_deletion.sql','utf8'));
await role(1);assert.equal((await db.query('select public.account_deletion_pending() x')).rows[0].x,false);await assert.rejects(work('begin',2));await assert.rejects(db.query('select public.delete_user_data()'));await assert.rejects(db.query('select * from account_private.deletions'));
await role(null,'service_role');const page=await work('begin',1);assert.equal(page.objects.length,5);assert.ok(page.objects.every(x=>x.name.startsWith(id(1)+'/')));assert.equal((await work('begin',1)).receipt,page.receipt,'start idempotent');
await role(1);assert.equal((await db.query('select public.account_deletion_pending() x')).rows[0].x,true);await assert.rejects(db.query('update public.users_profile set id=id where id=$1',[id(1)]),/ACCOUNT_DELETION_PENDING/);await assert.rejects(db.query('insert into storage.objects values($1,$2,$3)',['avatars',id(1)+'/new.jpg',id(1)]),/ACCOUNT_DELETION_PENDING/);
await role(2);await db.query('insert into storage.objects values($1,$2,$3)',['avatars',id(2)+'/new.jpg',id(2)]);
await db.exec('reset role');await assert.rejects(db.query('delete from auth.users where id=$1',[id(1)]),/ACCOUNT_FILES_REMAIN/);assert.equal((await db.query('select count(*)::int n from public.sessions')).rows[0].n,3,'file failure retains all data');
// Simulate successful Storage API acknowledgements in an isolated database only.
await db.query('delete from storage.objects where name like $1',[id(1)+'/%']);
await db.query('delete from auth.users where id=$1',[id(1)]);
assert.equal((await db.query('select count(*)::int n from public.sessions')).rows[0].n,1);assert.equal((await db.query('select parent_session_id from public.sessions')).rows[0].parent_session_id,null,'other users session preserved');
for(const table of ['user_tags','expenses','session_tasks','vault_files'])assert.equal((await db.query(`select count(*)::int n from public.${table}`)).rows[0].n,0);
assert.equal((await db.query('select count(*)::int n from community_private.moderators')).rows[0].n,0);assert.equal((await db.query('select count(*)::int n from storage.objects')).rows[0].n,2,'other user files untouched');assert.equal((await db.query('select count(*)::int n from community_private.reports')).rows[0].n,2,'anonymized moderation history retained');assert.deepEqual((await db.query('select snapshot from community_private.reports where id=$1',[id(40)])).rows[0].snapshot,{deleted_account:true});assert.equal((await db.query('select details from community_private.reports where id=$1',[id(41)])).rows[0].details,'');
await role(null,'service_role');assert.equal((await db.query("select public.account_deletion_work('receipt',$1) x",[page.receipt])).rows[0].x.complete,true);assert.equal((await work('receipt',99)).complete,false);
await role(1);await assert.rejects(db.query('insert into storage.objects values($1,$2,$3)',['avatars',id(1)+'/stale.jpg',id(1)]),/ACCOUNT_DELETION_PENDING/);
await role(null,'anon');await assert.rejects(work('begin',2));
console.log('PASS: own files including orphans/nested paths, private worker, resumable jobs, blocked writes and stale tokens, file failure preserves data, cascades, other accounts preserved, moderator role removal, anonymized evidence and lost-response receipt.');await db.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
