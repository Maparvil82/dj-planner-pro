const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function fixture(){
 const events=[];let accepted=true;const mod={exports:{}};
 const source=ts.transpileModule(fs.readFileSync('src/analytics/conversion.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports',source)(()=>({captureAnalytics:(...args)=>{if(accepted)events.push(args);return accepted;}}),mod,mod.exports);
 const entitlement={isActive:true,periodType:'NORMAL',productIdentifier:'pro.yearly',latestPurchaseDate:'2026-10-30T12:00:00Z',isSandbox:false};
 const input={userId:'a',previouslyPaid:false,success:true,userCancelled:false,customerInfo:{entitlements:{active:{'DJ Planner Pro':entitlement}}},productId:'pro.yearly',plan:'yearly'};
 return {record:mod.exports.recordProCheckout,events,input,entitlement,setAccepted:value=>{accepted=value;}};
}
test('confirmed checkout reports plan and sandbox only, once per purchase and account',()=>{
 const f=fixture();f.record(f.input);f.record(f.input);
 assert.deepEqual(f.events,[['pro_purchase_completed',{plan:'yearly',is_sandbox:false},'a']]);
 f.record({...f.input,userId:'b'});assert.equal(f.events.length,2);
});
test('cancelled, failed, already paid, inactive, mismatched products and free trials are not paid conversions',()=>{
 const f=fixture();for(const patch of [{success:false},{userCancelled:true},{previouslyPaid:true},{customerInfo:undefined},{productId:'other'}]) f.record({...f.input,...patch});
 for(const patch of [{isActive:false},{periodType:'TRIAL'},{periodType:'PROMOTIONAL'},{isSandbox:undefined},{latestPurchaseDate:''}]){
  const entitlement={...f.entitlement,...patch};f.record({...f.input,customerInfo:{entitlements:{active:{'DJ Planner Pro':entitlement}}}});
 }
 assert.equal(f.events.length,0);
});
test('sandbox purchases are labelled and missing consent cannot consume deduplication',()=>{
 const f=fixture();f.entitlement.isSandbox=true;f.setAccepted(false);f.record(f.input);assert.equal(f.events.length,0);
 f.setAccepted(true);f.record(f.input);assert.equal(f.events[0][1].is_sandbox,true);
});
test('checkout instrumentation is absent from restore and account refresh paths',()=>{
 const s=fs.readFileSync('src/context/SubscriptionContext.tsx','utf8');
 const purchase=s.slice(s.indexOf('const purchase ='),s.indexOf('const restorePurchases ='));
 assert(purchase.includes('recordProCheckout('));assert(purchase.indexOf('generation.current !== version')<purchase.indexOf('recordProCheckout('));
 assert(!s.slice(s.indexOf('const restorePurchases =')).includes('recordProCheckout('));
});
