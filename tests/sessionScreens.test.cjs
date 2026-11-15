const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {QueryClient}=require('@tanstack/react-query');
function moduleFixture(file,dependencies,globals={}){const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,require:name=>{if(name in dependencies)return dependencies[name];throw new Error(name);},setTimeout,clearTimeout,Intl,Date,...globals});return mod.exports;}
function serviceFixture(rpc){return moduleFixture('src/services/sessionScreens.ts',{'../lib/supabase':{supabase:{rpc}},'../utils/sessionPlanning':moduleFixture('src/utils/sessionPlanning.ts',{})});}
test('bounded date range follows every keyset page and propagates errors',async()=>{
const calls=[];let n=0;const {sessionScreens:s}=serviceFixture(async(name,args)=>{calls.push({name,args});return {data:{sessions:[{id:String(n++)}],nextCursor:n<3?{date:'2026-10-10',id:String(n)}:null}};});
assert.equal((await s.range('2026-10-01','2026-11-01')).length,3);assert(calls.every(c=>c.args.filters.from==='2026-10-01'&&c.args.filters.to==='2026-11-01'&&c.args.page_size===100));assert.equal(calls[1].args.cursor.id,'1');
const denied=serviceFixture(async()=>({error:new Error('denied')})).sessionScreens;await assert.rejects(denied.range('2026-10-01','2026-11-01'),/denied/);
});
test('dashboard expense pages retain their period and linked costs past 500 rows',async()=>{
const calls=[];const {sessionScreens:s}=serviceFixture(async(name,args)=>{calls.push({name,args});return {data:Array.from({length:args.page_offset===0?500:1},(_,i)=>({id:`${args.page_offset+i}`}))};});assert.equal((await s.expenses('2026-01-01','2027-01-01')).length,501);assert.deepEqual(calls.map(c=>c.args.page_offset),[0,500]);assert(calls.every(c=>c.name==='dashboard_expenses'&&c.args.from_date==='2026-01-01'&&c.args.to_date==='2027-01-01'));
});
test('card observers batch and deduplicate visible IDs, share cached results and keep account keys separate',async()=>{
let viewer='viewer-a',focused=true,options,states=[],index=0;const calls=[];const service=serviceFixture(async(name,args)=>{calls.push({name,ids:[...args.ids]});return {data:Object.fromEntries(args.ids.map(id=>[id,{completed:1,pending:2,expenseCount:1,expenses:{EUR:10}}]))};});
const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:30000}}});
const hooks=moduleFixture('src/hooks/useSessionScreens.ts',{
'react':{useEffect:()=>{},useState:initial=>{const i=index++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],()=>{}];}},
'expo-router':{useIsFocused:()=>focused},'@tanstack/react-query':{useQuery:o=>{options=o;return {};},useInfiniteQuery:o=>{options=o;return {};}},
'../store/useAuthStore':{useAuthStore:select=>select({session:{user:{id:viewer}},initialized:true})},'../services/sessionScreens':service});
const requests=[];for(let i=0;i<80;i++){hooks.useSessionCardSummary({id:`s${i}`,user_id:viewer});requests.push(client.fetchQuery(options));hooks.useSessionCardSummary({id:`s${i}`,user_id:viewer});requests.push(client.fetchQuery(options));}await Promise.all(requests);assert.deepEqual(calls.map(c=>c.ids.length),[50,30]);
hooks.useSessionCardSummary({id:'s0',user_id:viewer});await client.fetchQuery(options);assert.equal(calls.length,2);
viewer='viewer-b';hooks.useSessionCardSummary({id:'s0',user_id:viewer});assert(options.queryKey.includes('viewer-b'));await client.fetchQuery(options);assert.equal(calls.length,3);
hooks.useSessionCardSummary({id:'guest',user_id:'host',is_guest:true});assert.equal(options.enabled,false);focused=false;hooks.useSessionFeed({});assert.equal(options.enabled,false);
focused=true;index=0;hooks.useSessionScreenContext();const first=JSON.stringify(options.queryKey);index=0;hooks.useSessionScreenContext();assert.equal(JSON.stringify(options.queryKey),first,'a rerender must not create a new time key');
client.clear();
});
test('a rejected card batch rejects all waiters and the next request can recover',async()=>{
let fail=true;const service=serviceFixture(async()=>fail?{error:new Error('offline')}:{data:{s:{completed:0,pending:1}}});await assert.rejects(Promise.all([service.cardSummary('u','s'),service.cardSummary('u','s')]),/offline/);fail=false;assert.equal((await service.cardSummary('u','s')).pending,1);
});

test('next booking checks a bounded future window and orders event timezones without a 30-row cutoff',async()=>{
const calls=[],a={id:'a',date:'2030-01-01',start_time:'23:00',end_time:'23:59',booking_timezone:'Etc/GMT+12'},b={id:'b',date:'2030-01-03',start_time:'00:00',end_time:'01:00',booking_timezone:'Pacific/Kiritimati'};
const service=serviceFixture(async(name,args)=>{calls.push(args);return {data:{sessions:args.filters.upcoming?[a]:[a,b],nextCursor:null}};});
assert.equal((await service.sessionScreens.nextSession('2026-10-28T12:00:00Z')).id,'b');assert.equal(calls.length,2);assert.equal(calls[0].page_size,1);assert.equal(calls[1].filters.from,'2030-01-01');assert.equal(calls[1].filters.to,'2030-01-04');
});
