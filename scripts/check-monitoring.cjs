// Explicit, synthetic verification only. No account identifiers, receipts or app data.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),crypto=require('node:crypto');
const {BrowserClient,makeFetchTransport,defaultStackParser}=require('@sentry/browser');
const {parse}=require('dotenv');
const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/monitoring/privacy.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:mod,exports:mod.exports});
const {privateEvent,privateTransaction}=mod.exports;
const dsn=parse(fs.readFileSync('.env')).EXPO_PUBLIC_SENTRY_DSN;
if(!dsn)throw Error('Monitoring project not configured');
const statuses=[];
const client=new BrowserClient({dsn,integrations:[],stackParser:defaultStackParser,environment:'verification',release:'djplanner-monitoring-check@1.0.4',tracesSampleRate:1,sendDefaultPii:false,sendClientReports:false,beforeSend:privateEvent,beforeSendTransaction:privateTransaction,
 transport:options=>makeFetchTransport(options,async(url,options)=>{assert(!String(options.body).includes('private-sentinel'));const r=await fetch(url,options);statuses.push(r.status);return r})});
client.init();
const now=Date.now()/1000,errorId=crypto.randomUUID().replaceAll('-',''),traceId=crypto.randomUUID().replaceAll('-','');
client.captureEvent({event_id:errorId,level:'error',tags:{operation:'monitoring.check'},user:{email:'private-sentinel'},exception:{values:[{type:'MonitoringCheck',value:'private-sentinel',mechanism:{type:'generic',handled:true},stacktrace:{frames:[{filename:'monitoring-check.js',function:'verifyMonitoring',lineno:1,colno:1,in_app:true}]}}]}});
client.captureEvent({event_id:crypto.randomUUID().replaceAll('-',''),type:'transaction',transaction:'monitoring.check',start_timestamp:now-0.025,timestamp:now,contexts:{trace:{trace_id:traceId,span_id:crypto.randomBytes(8).toString('hex'),op:'app.operation',status:'ok'}},spans:[]});
(async()=>{const flushed=await client.flush(15000);assert(flushed);assert.equal(statuses.length,2);assert(statuses.every(status=>status===200));console.log(JSON.stringify({verified:true,statuses,errorId,traceId,environment:'verification',privateSentinelRemoved:true}));await client.close()})().catch(error=>{console.error(error.message);process.exitCode=1});
