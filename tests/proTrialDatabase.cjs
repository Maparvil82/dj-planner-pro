const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs');const assert=require('node:assert/strict');
const db=new PGlite();const legacy='00000000-0000-4000-8000-000000000983';
const owner='00000000-0000-4000-8000-000000000981',other='00000000-0000-4000-8000-000000000982';
async function role(name,id=''){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec(`set role ${name}`);}
async function usage(){return (await db.query('select public.get_session_usage() as r')).rows[0].r;}
async function start(){return (await db.query('select public.start_pro_trial() as r')).rows[0].r;}
(async()=>{
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
create schema account_private;create function account_private.active_user(id uuid) returns boolean language sql as $$select true$$;
create schema billing_private;grant usage on schema billing_private to authenticated,service_role;
create table billing_private.subscription_access(user_id uuid primary key references auth.users,pro_until timestamptz);
create function billing_private.has_pro_access() returns boolean language sql as $$select false$$;
create table public.sessions(id int generated always as identity,user_id uuid references auth.users,title text);alter table public.sessions enable row level security;
create policy own_sessions on sessions to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());grant select,insert,update on sessions to authenticated;grant usage on sequence sessions_id_seq to authenticated;`);
await db.exec(fs.readFileSync('supabase/migrations/20261014220808_standalone_pro_trial.sql','utf8'));
await db.query('insert into auth.users values($1)',[legacy]);
await db.query("insert into billing_private.pro_trials(user_id,started_at,expires_at) values($1,now(),now()+interval '1 month')",[legacy]);
const legacyExpiry=(await db.query('select expires_at from billing_private.pro_trials where user_id=$1',[legacy])).rows[0].expires_at;
await db.exec(fs.readFileSync('supabase/migrations/20261014232919_launch_offer_limits.sql','utf8'));
assert.equal(new Date((await db.query('select expires_at from billing_private.pro_trials where user_id=$1',[legacy])).rows[0].expires_at).getTime(),new Date(legacyExpiry).getTime());
await db.exec(`create trigger quota before insert on public.sessions for each row execute function billing_private.enforce_session_limit();grant execute on function public.get_session_usage() to authenticated;revoke execute on function public.get_session_usage() from public;`);
await db.query('insert into auth.users values($1),($2)',[owner,other]);
await role('anon');await assert.rejects(start,/permission denied/);
await role('authenticated');await assert.rejects(start,/Not authenticated/);
await role('authenticated',owner);
assert.equal((await usage()).trial.eligible,true);assert.equal((await usage()).limit,15);
await db.query("insert into sessions(user_id,title) select $1,'Free' from generate_series(1,15)",[owner]);
await assert.rejects(()=>db.query("insert into sessions(user_id,title) values($1,'16th')",[owner]),/session_limit_reached/);
const active=await start();assert.equal(active.isPro,true);assert.equal(active.paidPro,false);assert.equal(active.trial.status,'active');
assert.equal((await start()).trial.expiresAt,active.trial.expiresAt);
await assert.rejects(()=>db.query('update billing_private.pro_trials set expires_at=now()+interval \'1 year\''),/permission denied/);
await db.query('insert into sessions(user_id,title) select $1,\'Trial\' from generate_series(1,2)',[owner]);
assert.equal((await usage()).count,17);
await role('authenticated',other);assert.equal((await usage()).trial.eligible,true);assert.equal((await usage()).count,0);
await role('postgres');
const duration=(await db.query("select expires_at=started_at+interval '360 hours' as correct from billing_private.pro_trials where user_id=$1",[owner])).rows[0];assert.equal(duration.correct,true);
await db.query("update billing_private.pro_trials set started_at=now()-interval '2 months',expires_at=now()-interval '1 second' where user_id=$1",[owner]);
await role('authenticated',owner);const expired=await start();assert.equal(expired.isPro,false);assert.equal(expired.trial.status,'expired');assert.equal(expired.trial.eligible,false);
assert.equal(expired.count,17);await assert.rejects(()=>db.query("insert into sessions(user_id,title) values($1,'After')",[owner]),/session_limit_reached/);
await db.query("update sessions set title='Still editable' where user_id=$1",[owner]);
await role('postgres');await db.query("insert into billing_private.subscription_access values($1,now()+interval '1 year')",[owner]);
await role('authenticated',owner);assert.equal((await usage()).isPro,true);assert.equal((await usage()).paidPro,true);
await role('postgres');await db.query("insert into billing_private.subscription_access values($1,now()+interval '1 year')",[other]);
await role('authenticated',other);await assert.rejects(start,/trial.alreadyPro/);
console.log('PASS: authenticated single activation, exact 15-day trial, 15th free allowed/16th blocked, existing trial preserved, idempotent retries, private dates, trial quota, expiry retention/editing, account isolation and paid access precedence');await db.close();
})().catch(e=>{console.error(e);process.exit(1)});
