const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
let rpcResult,edgeResult,rpcCalls=[],edgeCalls=0;
const supabase={rpc:async name=>{rpcCalls.push(name);return rpcResult;},functions:{invoke:async()=>{edgeCalls++;return edgeResult;}}};
const m={exports:{}};new Function('exports','require',ts.transpileModule(fs.readFileSync('src/services/subscriptionAccess.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(m.exports,()=>({supabase}));
const {startProTrial,getCurrentAccess,syncSubscriptionAccess}=m.exports;
const free={count:12,limit:15,remaining:3,isPro:false,paidPro:false,trial:{eligible:true,status:'available'}};
test('activation uses only the authenticated trial RPC and never starts a store purchase',async()=>{
 rpcCalls=[];edgeCalls=0;rpcResult={data:{...free,isPro:true,trial:{status:'active',eligible:false}},error:null};
 assert.equal((await startProTrial()).isPro,true);assert.deepEqual(rpcCalls,['start_pro_trial']);assert.equal(edgeCalls,0);
});
test('server errors never produce synthetic Pro access',async()=>{
 rpcResult={data:null,error:{message:'trial.accountUnavailable'}};await assert.rejects(startProTrial,/trial.accountUnavailable/);
 rpcResult={data:null,error:{message:'network error'}};await assert.rejects(startProTrial,/trial.activationError/);
});
test('an active server trial works without calling RevenueCat',async()=>{
 edgeCalls=0;rpcResult={data:{...free,isPro:true,trial:{status:'active',eligible:false}},error:null};
 assert.equal((await getCurrentAccess()).isPro,true);assert.equal(edgeCalls,0);
});
test('after expiry, a paid subscription is checked and can preserve Pro',async()=>{
 edgeCalls=0;rpcResult={data:{...free,trial:{status:'expired',eligible:false}},error:null};edgeResult={data:{...free,isPro:true,paidPro:true},error:null};
 assert.equal((await getCurrentAccess()).paidPro,true);assert.equal(edgeCalls,1);
});
test('RevenueCat outage falls back only to current server access; database errors stay errors',async()=>{
 edgeResult={data:null,error:{message:'offline'}};rpcResult={data:free,error:null};assert.equal((await syncSubscriptionAccess()).isPro,false);
 rpcResult={data:null,error:{message:'offline'}};await assert.rejects(syncSubscriptionAccess,/billing.usageError/);
});
