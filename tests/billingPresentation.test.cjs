const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const exportsObject={};
new Function('exports',ts.transpileModule(fs.readFileSync('src/utils/billingPresentation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exportsObject);
const {hasBillingPeriod,annualSaving,subscriptionManagementUrl,freeIntroDuration}=exportsObject;
test('a quarterly or unknown product cannot be advertised as monthly or annual',()=>{
 assert.equal(hasBillingPeriod({subscriptionPeriod:'P3M'},'monthly'),false);
 assert.equal(hasBillingPeriod({subscriptionPeriod:null},'yearly'),false);
 assert.equal(hasBillingPeriod({subscriptionPeriod:'P1M'},'monthly'),true);
 assert.equal(hasBillingPeriod({subscriptionPeriod:'P12M'},'yearly'),true);
});
test('annual discount compares the full annual charge in the same currency',()=>{
 assert.equal(annualSaving({price:5,currencyCode:'EUR'},{price:45,currencyCode:'EUR'}),25);
 assert.equal(annualSaving({price:5,currencyCode:'EUR'},{price:45,currencyCode:'USD'}),0);
 assert.equal(annualSaving({price:0,currencyCode:'EUR'},{price:45,currencyCode:'EUR'}),0);
 assert.equal(annualSaving({price:5,currencyCode:'EUR'},{price:70,currencyCode:'EUR'}),0);
});
test('only an eligible free introductory offer is advertised; duration comes from the store',()=>{
 const intro={price:0,cycles:1,periodUnit:'WEEK',periodNumberOfUnits:1};
 assert.equal(freeIntroDuration(intro,false,'es'),null);
 assert.equal(freeIntroDuration(intro,true,'es'),'1 semana');
 assert.equal(freeIntroDuration({...intro,periodNumberOfUnits:2},true,'es'),'2 semanas');
 assert.equal(freeIntroDuration({...intro,price:1},true,'es'),null);
 assert.equal(freeIntroDuration({...intro,cycles:0},true,'es'),null);
 assert.equal(freeIntroDuration({...intro,periodUnit:'UNKNOWN'},true,'es'),null);
});
test('subscription management opens the appropriate store or SDK supplied URL',()=>{
 assert.match(subscriptionManagementUrl('android'),/play.google.com/);
 assert.match(subscriptionManagementUrl('ios'),/apps.apple.com/);
 assert.equal(subscriptionManagementUrl('ios','https://store.example/manage'),'https://store.example/manage');
});
const pricing={};
new Function('exports',ts.transpileModule(fs.readFileSync('src/config/proPricing.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(pricing);
const realPlanPricingState = pricing.planPricingState;
pricing.planPricingState = (...args) => realPlanPricingState(...args.slice(0, 5), new Date(2026, 10, 6));
test('launch messaging applies only to the current EUR launch price and stops after a price change',()=>{
 assert.equal(pricing.isAnnualLaunchPrice({price:15.99,currencyCode:'EUR'}),true);
 assert.equal(pricing.isAnnualLaunchPrice({price:15.99,currencyCode:'USD'}),false);
 assert.equal(pricing.isAnnualLaunchPrice({price:29.99,currencyCode:'EUR'}),false);
 assert.equal(pricing.isAnnualLaunchPrice({price:NaN,currencyCode:'EUR'}),false);
});

test('Spain reference prices are never advertised as the price for another country',()=>{
 assert.equal(pricing.hasReferencePrices('ES'),true);
 for (const region of ['US','GB','JP','DE','FR','IT','PT','BR',null,undefined]) assert.equal(pricing.hasReferencePrices(region),false);
});

test('storefront takes priority over physical country and accepts Apple country codes',()=>{
 assert.equal(pricing.isSpanishStorefront('ESP'),true);
 assert.equal(pricing.isSpanishStorefront('es'),true);
 assert.equal(pricing.hasSpanishPricing('USA','ES'),false);
 assert.equal(pricing.hasSpanishPricing('ESP','US'),true);
 assert.equal(pricing.hasSpanishPricing(null,'ES'),true);
});
test('a Spanish USD catalogue becomes an explicitly labelled reference, never a relabelled store price',()=>{
 const product={price:12.99,currencyCode:'USD'};
 const state=pricing.planPricingState('yearly',product,true,'ESP','ES');
 assert.deepEqual(state,{source:'reference',needsConfirmation:true,launch:true});
 assert.deepEqual(product,{price:12.99,currencyCode:'USD'});
 assert.deepEqual(pricing.planPricingState('monthly',{price:3.99,currencyCode:'USD'},true,'ESP','ES'),{source:'reference',needsConfirmation:true,launch:false});
});
test('Spanish EUR launch pricing shows the promotion only until the product price changes',()=>{
 assert.deepEqual(pricing.planPricingState('yearly',{price:15.99,currencyCode:'EUR'},true,'ESP','ES'),{source:'store',needsConfirmation:false,launch:true});
 assert.equal(pricing.planPricingState('yearly',{price:29.99,currencyCode:'EUR'},true,'ESP','ES').launch,false);
 assert.equal(pricing.planPricingState('monthly',{price:4.99,currencyCode:'EUR'},true,'ESP','ES').launch,false);
});
test('a US account in Spain keeps USD and missing products never become native purchase prices',()=>{
 assert.deepEqual(pricing.planPricingState('yearly',{price:12.99,currencyCode:'USD'},true,'USA','ES'),{source:'store',needsConfirmation:false,launch:false});
 assert.deepEqual(pricing.planPricingState('yearly',null,true,'ESP','ES'),{source:'unavailable',needsConfirmation:false,launch:false});
 assert.deepEqual(pricing.planPricingState('yearly',null,false,null,'ES'),{source:'reference',needsConfirmation:false,launch:true});
});

test('promotion includes January 6, ends January 7 and never changes monthly prices', () => {
 assert.equal(pricing.isAnnualPromotionActive(new Date(2027,0,6,23,59)),true);
 assert.equal(pricing.isAnnualPromotionActive(new Date(2027,0,7)),false);
 assert.equal(pricing.annualReferencePrice(new Date(2026,10,4)),15.99);
 assert.equal(pricing.annualReferencePrice(new Date(2026,10,5,23,59)),15.99);
 assert.equal(pricing.annualReferencePrice(new Date(2026,10,6)),15.99);
 assert.equal(pricing.annualReferencePrice(new Date(2027,0,7)),29.99);
 assert.equal(pricing.PRO_REFERENCE_PRICES.monthly,4.99);
 assert.equal(realPlanPricingState('yearly',{price:15.99,currencyCode:'EUR'},true,'ESP','ES',new Date(2027,0,7)).launch,false);
 assert.equal(realPlanPricingState('yearly',{price:14.99,currencyCode:'EUR'},true,'ESP','ES',new Date(2026,10,6)).launch,false);
 assert.equal(realPlanPricingState('monthly',{price:4.99,currencyCode:'EUR'},true,'ESP','ES',new Date(2026,10,6)).launch,false);
});
