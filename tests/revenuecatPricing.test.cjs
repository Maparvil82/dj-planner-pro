const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const source=ts.transpileModule(fs.readFileSync('src/services/revenuecat.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
function fixture(){
 const calls=[];
 const platform={OS:'ios'};
 const monthly={identifier:'$rc_monthly',presentedOfferingContext:{offeringIdentifier:'default'},product:{identifier:'djplanner.pro.monthly',price:3.99,currencyCode:'USD',priceString:'$3.99',subscriptionPeriod:'P1M'}};
 const annual={identifier:'$rc_annual',presentedOfferingContext:{offeringIdentifier:'default'},product:{identifier:'djplanner.pro.yearly',price:12.99,currencyCode:'USD',priceString:'$12.99',subscriptionPeriod:'P1Y'}};
 const offering={identifier:'default',monthly,annual,availablePackages:[monthly,annual]};
 const fresh=[{...monthly.product,price:4.99,currencyCode:'EUR',priceString:'4,99 €'},{...annual.product,price:14.99,currencyCode:'EUR',priceString:'14,99 €'}];
 const sdk={setLogLevel(){},configure(){},getOfferings:async()=>({current:offering}),getStorefront:async()=>({countryCode:'ESP'}),getProducts:async(ids,category)=>{calls.push({ids,category});return fresh;}};
 const module={exports:{}};
 new Function('require','module','exports','__DEV__',source)(name=>{
  if(name==='react-native')return {Platform:platform};
  if(name==='react-native-purchases')return {__esModule:true,default:sdk,LOG_LEVEL:{ERROR:'ERROR'},PRODUCT_CATEGORY:{SUBSCRIPTION:'SUBS'}};
  throw Error(name);
 },module,module.exports,false);
 return {service:module.exports.rcService,sdk,platform,offering,fresh,calls};
}
test('price refresh reads current store products while preserving package identity and purchase attribution',async()=>{
 const x=fixture();await x.service.configureRevenueCat('test-user');
 assert.equal(await x.service.getStorefrontCountry(),'ESP');
 const current=await x.service.getCurrentOffering(true);
 assert.deepEqual(x.calls,[{ids:['djplanner.pro.monthly','djplanner.pro.yearly'],category:'SUBS'}]);
 assert.equal(current.annual.product.currencyCode,'EUR');assert.equal(current.annual.product.price,14.99);
 assert.equal(current.annual.identifier,'$rc_annual');assert.deepEqual(current.annual.presentedOfferingContext,x.offering.annual.presentedOfferingContext);
 assert.equal(current.availablePackages[0].product.price,4.99);
 assert.equal(x.offering.annual.product.priceString,'$12.99','cached offering must not be mutated');
});
test('missing or failed product refresh cannot silently retain a stale annual checkout price',async()=>{
 const x=fixture();await x.service.configureRevenueCat('test-user');x.sdk.getProducts=async()=>[x.fresh[0]];
 const current=await x.service.getCurrentOffering(true);assert.equal(current.annual,null);assert.equal(current.availablePackages.length,1);
 x.sdk.getProducts=async()=>{throw Error('offline');};assert.equal(await x.service.getCurrentOffering(true),null);
});
test('unsupported storefront lookup stays unknown and Android retains its original offer selection',async()=>{
 const x=fixture();assert.equal(await x.service.getStorefrontCountry(),null);await x.service.configureRevenueCat('test-user');
 x.sdk.getStorefront=async()=>{throw Error('unavailable');};assert.equal(await x.service.getStorefrontCountry(),null);
 x.platform.OS='android';assert.equal(await x.service.getCurrentOffering(true),x.offering);assert.equal(x.calls.length,0);
});
