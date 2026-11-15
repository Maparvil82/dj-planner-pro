const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
function load(file,deps={}){const m={exports:{}};new Function('module','exports','require',ts.transpileModule(fs.readFileSync('supabase/functions/'+file+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(m,m.exports,p=>{if(!(p in deps))throw Error('Unknown import '+p);return deps[p];});return m.exports;}
const domain=load('poster-ai/domain'),store=load('poster-ai/store');
const c=load('poster-ai/commerce',{'./domain.ts':domain,'./store.ts':store});
const {webhookHandler}=load('poster-store-webhook/handler',{'../poster-ai/domain.ts':domain,'../poster-ai/commerce.ts':c});
const user='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const env={POSTER_REVENUECAT_SECRET_KEY:'sk_private-test',POSTER_REVENUECAT_PROJECT_ID:'proj2a56c306',POSTER_REVENUECAT_APP_ID:'app9256c04b19',POSTER_REVENUECAT_WEBHOOK_TOKEN:'x'.repeat(40)};
const config=c.storeConfig(n=>env[n]);
const product={app_id:config.app,one_time:{is_consumable:true},store_identifier:store.POSTER_PRODUCTS[0]};
const purchase={environment:'production',store:'app_store',product_id:'prod879a12c6a3',status:'owned',original_customer_id:user,customer_id:user,store_purchase_identifier:'200000001',quantity:1};
function mock(purchases=[purchase],options={}){let calls=[];const send=async(url,init)=>{calls.push(url);assert.equal(init.headers.Authorization,'Bearer sk_private-test');
 if(url.includes('/products/'))return Response.json(options.product??product);
 if(options.next&&calls.length===1)return Response.json({items:purchases,next_page:options.next});
 return Response.json({items:purchases,next_page:null});};return {send,calls};}
test('production config requires a private read key and webhook readiness before sales are advertised',()=>{
 assert.equal(c.storeReady(n=>env[n]),false);assert.equal(c.storeReady(n=>({...env,POSTER_STORE_WEBHOOK_READY:'true'})[n]),true);
 for(const patch of [{POSTER_REVENUECAT_SECRET_KEY:'appl_public'},{POSTER_REVENUECAT_PROJECT_ID:'https://attacker.example'}])assert.throws(()=>c.storeConfig(n=>({...env,...patch})[n]),/poster_store_unavailable/);
});
test('server purchase reconciliation uses canonical store transaction ids, skips Sandbox and foreign app products',async()=>{
 const {send,calls}=mock([purchase,{...purchase,environment:'sandbox'},{...purchase,original_customer_id:other,customer_id:user}]);
 const rows=await c.readPurchases(config,user,send);assert.equal(rows.length,1);assert.equal(rows[0].transaction,'200000001');assert.equal(rows[0].quantity,1);assert.equal(rows[0].refunded,false);assert.equal(calls.length,2);
 assert.deepEqual(await c.readPurchases(config,user,mock([purchase],{product:{...product,app_id:'other-app'}}).send),[]);
 const refunded=await c.readTransaction(config,'200000001',mock([{...purchase,status:'refunded'}]).send);assert.equal(refunded[0].refunded,true);
});
test('pagination is constrained to the exact RevenueCat resource and cannot exfiltrate the secret key',async()=>{
 for(const next of ['https://attacker.example/steal','/v2/projects/other/customers/other/purchases']){
  const {send,calls}=mock([purchase],{next});await assert.rejects(c.readPurchases(config,user,send),/poster_store_unavailable/);assert.equal(calls.length,2);
 }
 let n=0;const rows=await c.readPurchases(config,user,async(url)=>{n++;if(url.includes('/products/'))return Response.json(product);return Response.json({items:[purchase],next_page:url.includes('starting_after')?null:`/v2/projects/proj2a56c306/customers/${user}/purchases?starting_after=one`});});assert.equal(rows.length,2);assert.equal(n,3);
 await assert.rejects(c.readPurchases(config,user,async()=>new Response('',{status:429})),/poster_store_unavailable/);
});
test('webhook requires its own secret, ignores test/subscription events and durably applies current verified state',async()=>{
 let applied=[];let calls=0;const {send}=mock([{...purchase,status:'refunded'}]);
 const handler=webhookHandler(n=>env[n],async p=>applied.push(p),async(...args)=>{calls++;return send(...args);});
 const event={type:'NON_RENEWING_PURCHASE',environment:'PRODUCTION',app_id:config.app,store:'APP_STORE',product_id:store.POSTER_PRODUCTS[0],transaction_id:'200000001'};
 const request=(e=event,auth=`Bearer ${env.POSTER_REVENUECAT_WEBHOOK_TOKEN}`)=>new Request('https://example.test/webhook',{method:'POST',headers:{Authorization:auth},body:JSON.stringify({event:e})});
 assert.equal((await handler(request(event,'bad'))).status,401);assert.equal(calls,0);
 for(const change of [{type:'TEST'},{environment:'SANDBOX'},{app_id:'wrong'},{product_id:'subscription'},{type:'INITIAL_PURCHASE'}])assert.equal((await handler(request({...event,...change}))).status,200);
 assert.equal(calls,0);assert.equal((await handler(request())).status,200);assert.equal(applied.length,1);assert.equal(applied[0].refunded,true); // Old purchase event cannot reverse a current refund.
 const failing=webhookHandler(n=>env[n],async()=>{throw Error('db unavailable');},send);assert.equal((await failing(request())).status,503);
 const noConfig=webhookHandler(()=>undefined,async()=>assert.fail());assert.equal((await noConfig(request())).status,503);
});
test('Pro welcome eligibility follows active server entitlements, including trial and shared access',()=>{
 const now=Date.parse('2026-10-23');const info={subscriber:{entitlements:{'DJ Planner Pro':{product_identifier:'annual',expires_date:'2027-01-01'}},subscriptions:{annual:{is_sandbox:false,period_type:'normal'}}}};
 assert.equal(c.verifiedPro(info,now),true);
 for(const patch of [{is_sandbox:true},{period_type:'trial'},{ownership_type:'FAMILY_SHARED'}])assert.equal(c.verifiedPro({...info,subscriber:{...info.subscriber,subscriptions:{annual:{...info.subscriber.subscriptions.annual,...patch}}}},now),true);
 assert.equal(c.verifiedPro({...info,subscriber:{...info.subscriber,subscriptions:{annual:{refunded_at:'today'}}}},now),false);
 assert.equal(c.verifiedPro({subscriber:{entitlements:{'DJ Planner Pro':{product_identifier:'lifetime',expires_date:null}}}},now),true);
 assert.equal(c.verifiedPro(info,Date.parse('2028-01-01')),false);assert.equal(c.verifiedPro({}),false);
});
test('promotion identity hash is salted, stable across account recreation, and contains no email',async()=>{
 const hash=await c.promotionIdentity(' Person@example.com ','s'.repeat(40));assert.match(hash,/^[a-f0-9]{64}$/);
 assert.equal(await c.promotionIdentity('person@example.com','s'.repeat(40)),hash);
 assert.notEqual(await c.promotionIdentity('person@example.com','z'.repeat(40)),hash);
 await assert.rejects(c.promotionIdentity('person@example.com',''),/poster_promotion_unavailable/);
});
