const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,requireMock=()=>{throw Error('Unexpected runtime import')},globals={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:requireMock,...globals});return m.exports}
const privacy=load('src/monitoring/privacy.ts');
test('diagnostic payload removes identities, URLs, request data, messages and stack locals without mutating the original',()=>{
 const secret='private-test@example.com';
 const event={event_id:'diagnostic-id',release:'com.djplannerpro.app@1.0.4+7',environment:'production',user:{email:secret,id:secret,ip_address:'1.2.3.4'},request:{url:secret,headers:{Authorization:secret},data:secret},extra:{receipt:secret},breadcrumbs:[{message:secret}],message:secret,tags:{operation:'query.sessions',query:secret},contexts:{device:{model:'iPhone',id:secret},os:{name:'iOS',version:'26.0'},app:{app_version:'1.0.4',app_build:'7',app_name:secret},react_navigation:{params:secret}},exception:{values:[{type:'TypeError',value:secret,mechanism:{type:'generic',handled:false,data:{secret}},stacktrace:{frames:[{filename:'https://localhost/index.bundle?access_token='+secret,abs_path:secret,function:'render',vars:{secret},pre_context:[secret],lineno:45,colno:8,in_app:true}]}}]},debug_meta:{images:[{type:'sourcemap',debug_id:'debug-id',code_file:'https://localhost/index.bundle?token='+secret}]}};
 const clean=privacy.privateEvent(event),wire=JSON.stringify(clean);assert(!wire.includes(secret));assert(!wire.includes('1.2.3.4'));assert.equal(clean.release,event.release);assert.equal(clean.exception.values[0].stacktrace.frames[0].lineno,45);assert.equal(clean.debug_meta.images[0].code_file,'index.bundle');assert.equal(event.user.email,secret);
});
test('only named app transactions pass; automatic HTTP spans and cancelled screen loads are excluded',()=>{
 assert.equal(privacy.privateTransaction({transaction:'https://private.invalid/session?id=123'}),null);
 const transaction={transaction:'screen.home',start_timestamp:1,timestamp:2,type:'transaction',spans:[{description:'private query'}],contexts:{trace:{trace_id:'trace',span_id:'span',op:'ui.load',data:{url:'private url'}}}};
 const clean=privacy.privateTransaction(transaction);assert.equal(clean.transaction,'screen.home');assert.equal(clean.start_timestamp,1);assert.equal(clean.spans.length,0);assert(!JSON.stringify(clean).includes('private'));
 assert.equal(privacy.privateTransaction({...transaction,contexts:{trace:{data:{'app.cancelled':true}}}}),null);
});
function fixture(env={},dev=false,expoGo=false){let options,captured=0,clock=100000;const spans=[];const sentry={init:o=>{options=o},wrap:c=>c,withScope:fn=>fn({setTag(){}}),captureException:()=>{captured++},startInactiveSpan:o=>{const span={options:o,status:null,ends:0,setStatus(s){this.status=s},setAttribute(){},end(){this.ends++}};spans.push(span);return span}};const mod=load('src/monitoring/index.ts',name=>name==='@sentry/react-native'?sentry:name==='expo'?{isRunningInExpoGo:()=>expoGo}:name==='./privacy'?privacy:null,{process:{env},__DEV__:dev,Date:{now:()=>clock}});return {mod,spans,get options(){return options},get captured(){return captured},tick:()=>{clock+=60001}}}
test('monitoring stays off without configuration and development requires explicit opt-in',()=>{
 for(const f of [fixture(),fixture({EXPO_PUBLIC_SENTRY_DSN:'https://example.invalid/1'},true)]){assert.equal(f.options,undefined);f.mod.captureOperationFailure('query.sessions',Error('test'));assert.equal(f.captured,0)}
});
test('production strips private collection, limits sampled traces and suppresses repeated operation errors',()=>{
 const f=fixture({EXPO_PUBLIC_SENTRY_DSN:'https://example.invalid/1'});assert.equal(f.options.sendDefaultPii,false);assert.equal(f.options.tracesSampleRate,0.1);assert.equal(f.options.enableLogs,false);assert.equal(f.options.maxBreadcrumbs,0);assert.equal(f.options.attachScreenshot,false);assert.equal(f.options.enableAutoPerformanceTracing,false);
 const hint={attachments:[{data:'receipt'}]};f.options.beforeSend({},hint);assert.equal(hint.attachments.length,0);
 f.mod.captureOperationFailure('query.sessions',Error('test'));f.mod.captureOperationFailure('query.sessions',Error('again'));assert.equal(f.captured,1);f.tick();f.mod.captureOperationFailure('query.sessions',Error('later'));assert.equal(f.captured,2);
 assert.equal(f.mod.queryOperation(['sessions','private-user','private-title']),'query.sessions');
 const finish=f.mod.startOperation('screen.home');finish();finish();assert.equal(f.spans[0].ends,1);
});
test('Expo Go uses JavaScript diagnostics with all native handlers disabled',()=>{
 const f=fixture({EXPO_PUBLIC_SENTRY_DSN:'https://example.invalid/1',EXPO_PUBLIC_SENTRY_DEV_ENABLED:'true'},true,true);assert.equal(f.options.enableNative,false);assert.equal(f.options.enableNativeCrashHandling,false);
});
