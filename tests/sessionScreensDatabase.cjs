const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const db=new PGlite();const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function load(name){const filename=path.resolve(__dirname,`../src/utils/${name}.ts`),m=new Module(filename,module);m.require=r=>r.startsWith('./')?load(r.slice(2)):require(r);m._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);return m.exports;}
const {sessionEarnings,sessionRange,sessionBalance}=load('sessionPlanning');
const {dashboardMetrics,dashboardInsights,dashboardChart,currencyCode}=load('dashboardMetrics');
const {dashboardAdvancedAnalytics}=load('dashboardAdvancedAnalytics');const {dashboardWindow}=load('dashboardWindow');
const now=new Date('2026-10-28T12:00:00Z'),zone='Europe/Madrid',labels=['Sesión en {venue}','Sesión sin título'];
async function as(user,role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user?uid(user):'']);await db.exec(`set role ${role}`);}
async function rpc(name,params){const args=params.map((_,i)=>`$${i+1}`).join(',');if(name==='dashboard_expenses')return(await db.query(`select to_jsonb(e) as result from public.${name}(${args}) e`,params)).rows.map(r=>r.result);return(await db.query(`select public.${name}(${args}) as result`,params)).rows[0].result;}
async function page(filters={},cursor=null,asc=false,size=50){return rpc('session_screen_page',[filters,cursor,asc,...labels,now,zone,size]);}
async function all(filters={}){const rows=[];let cursor=null;do{const p=await page(filters,cursor);rows.push(...p.sessions);cursor=p.nextCursor;}while(cursor);return rows;}
(async()=>{
await db.exec(`create role anon;create role authenticated;create schema auth;create schema community_private;create schema account_private;
grant usage on schema auth,community_private,account_private to authenticated;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function account_private.active_user(id uuid) returns boolean language sql stable as $$select id<>'${uid(4)}'::uuid$$;
create table users_profile(id uuid primary key,artist_name text);
create table sessions(id uuid primary key default gen_random_uuid(),user_id uuid,date date,title text,venue text,venue_id uuid,venue_city text,venue_city_location jsonb,venue_address text,booking_timezone text,start_time text default '22:00',end_time text default '04:00',color text,status text default 'confirmed',poster_url text,poster_focus_x float8,poster_focus_y float8,currency text default 'EUR',created_at timestamptz default now(),updated_at timestamptz default now(),parent_session_id uuid,is_collective boolean default false,djs text[],earning_type text default 'fixed',earning_amount numeric default 100,amount_paid numeric default 0,fee_agreement jsonb,notes text);
create table session_collaborators(session_id uuid,dj_id uuid,inviter_id uuid,status text,unique(session_id,dj_id));
create table expenses(id uuid primary key default gen_random_uuid(),user_id uuid,session_id uuid,amount numeric,currency text,date date,included_in_agreement boolean default false);
create table session_tasks(id uuid primary key default gen_random_uuid(),user_id uuid,session_id uuid,completed boolean);
create index sessions_owner_date_idx on sessions(user_id,date,id);create index collaborators_viewer_idx on session_collaborators(dj_id,status,session_id);
create index expenses_owner_date_idx on expenses(user_id,date desc,id);create index expenses_session_id_idx on expenses(session_id);create index session_tasks_session_idx on session_tasks(session_id,created_at) with (fillfactor=90);`.replace('session_id,created_at','session_id'));
for(const table of ['sessions','expenses','session_tasks'])await db.exec(`alter table ${table} enable row level security;grant select on ${table} to authenticated,anon;create policy owner on ${table} for select using(user_id=(select auth.uid()));`);
await db.exec(`insert into users_profile values('${uid(1)}','Viewer'),('${uid(2)}','Host');
insert into sessions(id,user_id,date,title,venue,notes) values('${uid(10)}','${uid(2)}','2026-10-25','Invitation','Host Club','secret'),('${uid(11)}','${uid(2)}','2026-10-26','Not accepted','Private Club','secret'),('${uid(12)}','${uid(2)}','2026-10-27','Forged','Private Club','secret');
insert into session_collaborators values('${uid(10)}','${uid(1)}','${uid(2)}','accepted'),('${uid(11)}','${uid(1)}','${uid(2)}','invited'),('${uid(12)}','${uid(1)}','${uid(3)}','accepted');
insert into sessions(id,user_id,date,title,venue,earning_type,earning_amount,amount_paid,currency,status,booking_timezone,start_time,end_time,fee_agreement,parent_session_id)
select ('00000000-0000-4000-8000-'||lpad((n+100)::text,12,'0'))::uuid,'${uid(1)}',date '2020-01-01'+(n%3000),case when n%9=0 then '  ' else 'Gig '||n end,case when n%4=0 then ' Órbita  Club ' else 'Club '||(n%7) end,
(array['fixed','hourly','free','agreement'])[1+n%4],(n%200)+0.17,case when n%5=0 then 10 else 0 end,(array['EUR','$','€','GBP'])[1+n%4],(array['confirmed','confirmed','pending','cancelled'])[1+n%4],case when n%3=0 then 'America/New_York' else 'Europe/Madrid' end,'22:30',case when n%3=0 then '03:15' else '05:15' end, jsonb_build_object('settled',n%8=3),case when n%10=0 then '${uid(101)}'::uuid else null end from generate_series(1,1800)n;
-- Many same-day rows exercise the tie-breaker beyond one page.
insert into sessions(user_id,date,title,venue) select '${uid(1)}','2026-10-02','Crowded '||n,'Club X' from generate_series(1,125)n;
insert into sessions(id,user_id,date,title,venue,earning_type,earning_amount,start_time,end_time) values('${uid(20)}','${uid(1)}','2026-10-27','Hourly','Club X','hourly',17.33,'23:15','06:20'),('${uid(21)}','${uid(1)}','2026-10-27','No title','','fixed',10,'22:00','04:00');
insert into expenses(user_id,session_id,amount,currency,date) values('${uid(1)}','${uid(20)}',10.10,'€','2010-01-01'),('${uid(1)}','${uid(20)}',1.20,'EUR','2026-10-27'),('${uid(1)}','${uid(20)}',1.005,'EUR','2026-10-27'),('${uid(1)}',null,20,'GBP','2026-10-01'),('${uid(2)}','${uid(10)}',999,'EUR','2026-10-01');
insert into session_tasks(user_id,session_id,completed) values('${uid(1)}','${uid(20)}',true),('${uid(1)}','${uid(20)}',false),('${uid(2)}','${uid(10)}',false);`);
await db.exec(fs.readFileSync('supabase/migrations/20261028105317_session_screen_queries.sql','utf8'));
await db.exec(fs.readFileSync('supabase/migrations/20261028105909_session_card_rounding.sql','utf8'));
await as(1);
const rows=await all();assert.equal(rows.length,1928);assert.equal(new Set(rows.map(s=>s.id)).size,rows.length);assert(rows.every(s=>s.user_id===uid(1)||s.id===uid(10)));
const guest=rows.find(s=>s.id===uid(10));assert.equal(guest.is_guest,true);assert.equal(guest.earning_amount,0);assert.equal(guest.earning_type,'free');for(const key of ['notes','amount_paid','fee_agreement','venue_id','parent_session_id','dj_profile_ids'])assert(!(key in guest));
const ordered=[...rows].sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));assert.deepEqual(rows,ordered);
let ascending=[],cursor=null;do{const p=await page({},cursor,true,100);ascending.push(...p.sessions);cursor=p.nextCursor;}while(cursor);assert.deepEqual(ascending.map(s=>s.id),rows.map(s=>s.id).reverse());
assert.equal((await page({},null,false,10000)).sessions.length,100);assert.equal((await page({},null,false,0)).sessions.length,1);
const display=s=>s.title?.trim()|| (s.venue?.trim()?labels[0].replace('{venue}',s.venue.trim()):labels[1]);
const filters=[{from:'2026-10-01',to:'2026-11-01'},{search:'sesión en'},{search:'CLUB x'},{venues:['Club X']},{titles:['Invitation']},{earningTypes:['free']},{min:110,max:160},{min:0,max:0},{search:'%',from:'2026-10-01',to:'2026-11-01'}];
for(const f of filters){const expected=rows.filter(s=>(!f.from||s.date>=f.from)&&(!f.to||s.date<f.to)&&(!f.search||[display(s),s.venue].some(v=>v.toLowerCase().includes(f.search.toLowerCase())))&&(!f.venues||f.venues.includes(s.venue))&&(!f.titles||f.titles.includes(display(s)))&&(!f.earningTypes||f.earningTypes.includes(s.earning_type))&&(f.min==null||(s.status==='cancelled'?0:sessionEarnings(s))>=f.min)&&(f.max==null||(s.status==='cancelled'?0:sessionEarnings(s))<=f.max));assert.deepEqual((await all(f)).map(s=>s.id),expected.map(s=>s.id),JSON.stringify(f));}
const marks=await rpc('session_calendar_marks',[{from:'2026-10-01',to:'2026-11-01'},...labels]);assert.deepEqual(marks.map(m=>m.date),[...new Set(rows.filter(s=>s.date>='2026-10-01'&&s.date<'2026-11-01').map(s=>s.date))].sort());assert(marks.some(m=>m.date==='2026-10-02'));
await assert.rejects(rpc('session_calendar_marks',[{from:'2020-01-01',to:'2026-11-01'},...labels]),/calendar_range_required/);
for(const date of ['2026-10-02','2026-10-03','2026-10-26','2026-11-28']){const previous=new Date(date+'T12:00Z');previous.setUTCDate(previous.getUTCDate()-1);const actual=await page({blockedDay:date},null,false,1);const expected=rows.some(s=>s.status!=='cancelled'&&(s.date===date||(s.date===previous.toISOString().slice(0,10)&&s.end_time<=s.start_time&&s.end_time!=='00:00')));assert.equal(actual.sessions.length>0,expected);}
const options=await rpc('session_screen_options',labels);assert.deepEqual([...options.titles].sort(),[...new Set(rows.map(display))].sort());assert(!options.venues.includes('Private Club'));
const context=await rpc('session_screen_context',[now,zone,true]);assert.equal(context.reviewCount,new Set(rows.filter(s=>!s.is_guest&&s.status!=='cancelled').map(s=>s.parent_session_id||s.id)).size);
const currencies=[...new Set([...rows.filter(s=>!s.is_guest&&s.status!=='cancelled'&&s.earning_type!=='free').map(s=>currencyCode(s.currency)),'EUR','GBP'])].sort();assert.deepEqual(context.currencies,currencies);
for(const currency of currencies){const expected=dashboardAdvancedAnalytics(rows,[],[],now,'month',currency,now).aging;for(const bucket of expected){const actual=context.aging.find(a=>a.key===bucket.key&&a.currency===currency);assert.equal(actual?.count||0,bucket.count);assert.equal(actual?.amount||0,bucket.amount);assert.deepEqual((await all({aging:bucket.key,currency})).map(s=>s.id),rows.filter(s=>bucket.sessions.some(item=>item.id===s.id)).map(s=>s.id));}}
const upcoming=await all({from:'2026-10-26',upcoming:true});assert.deepEqual(upcoming.map(s=>s.id),rows.filter(s=>s.date>='2026-10-26'&&s.status!=='cancelled'&&sessionRange(s).end>now).map(s=>s.id));
const expenses=(await db.query('select to_jsonb(e) as result from expenses e')).rows.map(r=>r.result);const scopedExpenses=await rpc('dashboard_expenses',['2026-10-01','2026-11-01',0]);assert.equal(scopedExpenses.length,4);assert(scopedExpenses.some(e=>e.date==='2010-01-01'));
const summary=await rpc('session_card_summaries',[[uid(20),uid(10)]]);assert.equal(summary[uid(20)].completed,1);assert.equal(summary[uid(20)].pending,1);assert.equal(summary[uid(20)].expenseCount,3);assert.deepEqual(summary[uid(20)].expenses,{EUR:12.3});assert(!summary[uid(10)]);
// Bounded windows must retain every statistic, including first visits before the window.
for(const [anchor,period] of [[now,'month'],[now,'year'],[new Date('2021-06-01T12:00Z'),'month']]){
 const w=dashboardWindow(anchor,period,now),bounded=rows.filter(s=>(s.date>=w.main.from&&s.date<w.main.to)||(s.date>=w.upcoming.from&&s.date<w.upcoming.to));
 const boundExpenses=expenses.filter(e=>(e.date>=w.main.from&&e.date<w.main.to)||bounded.some(s=>s.id===e.session_id&&s.date>=w.main.from&&s.date<w.main.to));
 for(const currency of currencies){assert.deepEqual(dashboardMetrics(bounded,boundExpenses,anchor,period,currency,now),dashboardMetrics(rows,expenses,anchor,period,currency,now));assert.deepEqual(dashboardChart(bounded,anchor,period,currency),dashboardChart(rows,anchor,period,currency));const limited=dashboardInsights(bounded,[],anchor,period,currency,now,context.firstCompleted),full=dashboardInsights(rows,[],anchor,period,currency,now);assert.deepEqual(limited,full);const a=dashboardAdvancedAnalytics(bounded,boundExpenses,[],anchor,period,currency,now,context.aging),b=dashboardAdvancedAnalytics(rows,expenses,[],anchor,period,currency,now);assert.deepEqual({...a,aging:a.aging.map(({sessions,...rest})=>rest)},{...b,aging:b.aging.map(({sessions,...rest})=>rest)});}
}
await as(2);assert.equal((await all()).length,3);assert.equal((await rpc('dashboard_expenses',['2020-01-01','2028-01-01',0])).length,1);assert.deepEqual(await rpc('session_card_summaries',[[uid(20)]]),{});
await as(3);assert.equal((await all()).length,0);assert.equal((await rpc('session_screen_context',[now,zone,true])).reviewCount,0);
await as(4);await assert.rejects(page(),/insufficient_privilege/);
await as(null,'anon');for(const [name,args] of [['session_screen_page',[{},null,false,...labels,now,zone,50]],['session_screen_context',[now,zone,true]],['session_screen_options',labels],['session_calendar_marks',[{from:'2026-10-01',to:'2026-11-01'},...labels]],['dashboard_expenses',['2020-01-01','2028-01-01',0]],['session_card_summaries',[[uid(20)]]]])await assert.rejects(rpc(name,args),/permission denied/);
console.log('PASS: 1,928 visible sessions; stable complete pagination, 9 combined filter cases, calendar marks, guest privacy, owner/anonymous/deleting-account isolation, currencies/aging, linked expenses, task batches, and identical dashboard calculations across current/historical month/year.');
await db.close();
})().catch(async error=>{console.error(error);await db.close();process.exitCode=1;});
