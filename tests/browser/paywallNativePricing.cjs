// Render the actual native paywall/provider/service with a local, simulated store.
// No store credentials, payments, database calls or production test switches are used.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),dir='/tmp/djp-native-paywall-fixture';fs.mkdirSync(dir,{recursive:true});
const virtual={
 'react-native':`const R=require('react');
 function style(x){if(Array.isArray(x))return Object.assign({},...x.map(style));if(!x)return {};const s={...x};if(s.paddingHorizontal!==undefined){s.paddingLeft=s.paddingRight=s.paddingHorizontal;delete s.paddingHorizontal;}if(s.paddingVertical!==undefined){s.paddingTop=s.paddingBottom=s.paddingVertical;delete s.paddingVertical;}if(s.flexDirection||s.alignItems)s.display='flex';if(typeof s.lineHeight==='number')s.lineHeight=s.lineHeight+'px';return s;}
 function primitive(tag){return function({children,style:s,testID,accessibilityRole,accessibilityLabel,accessibilityState,onPress,disabled,...p}){return R.createElement(tag,{'data-testid':testID,role:accessibilityRole,'aria-label':accessibilityLabel,'aria-checked':p['aria-checked'],'aria-disabled':accessibilityState?.disabled,disabled,onClick:onPress,style:{...(tag==='span'?{display:'block'}:{display:'flex',flexDirection:'column',position:'relative'}),pointerEvents:p.pointerEvents,...style(s)}},children);}}
 const V=primitive('div'),T=primitive('span'),B=primitive('button');
 window.billingAppActive=()=>window.billingActiveListener?.('active');
 module.exports={View:V,Text:T,TouchableOpacity:B,ImageBackground:V,ActivityIndicator:()=>R.createElement('span',null,'…'),ScrollView:R.forwardRef((p,ref)=>{R.useImperativeHandle(ref,()=>({scrollTo(){}}));const {contentContainerStyle,children,...rest}=p;return R.createElement(V,{...rest,style:[{flex:1},rest.style]},R.createElement(V,{style:contentContainerStyle},children));}),useWindowDimensions:()=>({width:innerWidth,height:innerHeight}),Platform:{OS:'ios'},AppState:{addEventListener(_name,f){window.billingActiveListener=f;return {remove(){window.billingActiveListener=null;}};}}};`,
 'react-native-purchases':`const product=(plan,currency,price)=>({identifier:'djplanner.pro.'+(plan==='monthly'?'monthly':'yearly'),price,currencyCode:currency,priceString:new Intl.NumberFormat(currency==='EUR'?'es-ES':'en-US',{style:'currency',currency}).format(price),subscriptionPeriod:plan==='monthly'?'P1M':'P1Y',introPrice:null});
 const pack=(plan,p)=>({identifier:plan==='monthly'?'$rc_monthly':'$rc_annual',product:p,presentedOfferingContext:{offeringIdentifier:'default'}});
 const monthly=pack('monthly',product('monthly','USD',3.99)),annual=pack('yearly',product('yearly','USD',12.99));
 const info=()=>({entitlements:{active:window.billingMock.purchased?{'DJ Planner Pro':{}}:{}},managementURL:null});
 module.exports={__esModule:true,LOG_LEVEL:{ERROR:'ERROR'},PRODUCT_CATEGORY:{SUBSCRIPTION:'SUBS'},default:{setLogLevel(){},configure(){},addCustomerInfoUpdateListener(){},removeCustomerInfoUpdateListener(){},getCustomerInfo:async()=>info(),getStorefront:async()=>({countryCode:window.billingMock.country}),getOfferings:async()=>({current:{identifier:'default',monthly,annual,availablePackages:[monthly,annual]}}),getProducts:async()=>{window.billingMock.productFetches++;const s=window.billingMock;const products=s.mode==='usd'?[monthly.product,annual.product]:[product('monthly','EUR',4.99),product('yearly','EUR',s.mode==='standard'?39.99:14.99)];if(s.deferProducts)return await new Promise(resolve=>{s.productWaiters.push(()=>resolve(products));});return products;},checkTrialOrIntroductoryPriceEligibility:async()=>({}),purchasePackage:async(pkg)=>{window.billingMock.purchases.push({id:pkg.product.identifier,currency:pkg.product.currencyCode,package:pkg.identifier});if(window.billingMock.holdPurchase)await new Promise(resolve=>{window.billingMock.finishPurchase=resolve;});window.billingMock.purchased=true;return {customerInfo:info()};}}};`,
 'expo-constants':`module.exports={__esModule:true,default:{executionEnvironment:'standalone'},ExecutionEnvironment:{StoreClient:'store-client'}};`,
 'expo-status-bar':`module.exports={StatusBar:()=>null};`,
 'expo-linear-gradient':`module.exports={LinearGradient:require('react-native').View};`,
 'react-native-safe-area-context':`module.exports={SafeAreaView:require('react-native').View};`,
 'expo-linking':`module.exports={openURL:async()=>{}};`,
 'expo-router':`module.exports={useIsFocused:()=>true,useLocalSearchParams:()=>({}),useRouter:()=>({canGoBack:()=>false,replace(){},back(){}}),Redirect:()=>null};`,
 'react-native-reanimated':`module.exports={__esModule:true,default:{View:require('react-native').View},FadeIn:{duration:()=>null}};`,
 'lucide-react-native':`const R=require('react');const icon=()=>R.createElement('span',{'aria-hidden':true},'↗');module.exports={X:icon,Check:()=>R.createElement('span',{'aria-hidden':true},'✓'),ChevronLeft:icon,ArrowUpRight:icon,ShieldCheck:icon,CalendarDays:icon,CreditCard:icon};`,
 '@tanstack/react-query':`module.exports={useQuery:()=>({data:{}}),useQueryClient:()=>({setQueryData(){},invalidateQueries:async()=>{}})};`,
};
const local={
 'src/analytics/index.ts':`module.exports={captureAnalytics:()=>true};`,
 'src/store/useAuthStore.ts':`const state={session:{user:{id:'fixture-user'}},user:{id:'fixture-user'},initialized:true};function useAuthStore(selector){return selector(state);}useAuthStore.getState=()=>state;module.exports={useAuthStore};`,
 'src/i18n/useTranslation.ts':`const copy=require('${path.join(root,'src/i18n/languages/es.json')}');const t=(key,values={})=>String(key.split('.').reduce((x,k)=>x?.[k],copy)||key).replace(/{{([^}]+)}}/g,(_,k)=>values[k.trim()]??'');module.exports={useTranslation:()=>({t,currentLanguage:'es',dateLocale:'es-ES',numberLocale:'es-ES',regionCode:'ES'})};`,
 'src/hooks/useSessionUsage.ts':`module.exports={useSessionUsage:()=>({data:{isPro:false,paidPro:false,trial:{status:'available',eligible:true}},isPending:false,isError:false,refetch:async()=>{}})};`,
 'src/components/community/communityColors.ts':`module.exports={useCommunityColors:()=>({dark:true,bg:'#171717',card:'#232323',fg:'#EEF3E1',muted:'#D2D1C7',accent:'#DCEB7D',onAccent:'#171717',tint:'#2c301e',field:'#232323',border:'#45443F'})};`,
 'src/config/features.ts':`module.exports={FEATURES:{bookings:false}};`,
 'src/services/subscriptionAccess.ts':`module.exports={syncSubscriptionAccess:async()=>({paidPro:true}),startProTrial:async()=>({})};`,
 'src/services/bookings.ts':`module.exports={bookingCall:async()=>({})};`,
 'src/utils/showError.ts':`module.exports={showError:(title,message)=>{window.billingErrors.push(title+': '+message);}};`,
};
const modules=new Map();
function resolve(request,parent){if(virtual[request])return 'virtual:'+request;let file;if(request.startsWith('.')||request.startsWith('/')){const candidate=path.resolve(path.dirname(parent),request);file=['','.ts','.tsx','.js','.json','/index.ts','/index.tsx'].map(ext=>candidate+ext).find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());}if(!file)file=require.resolve(request,{paths:[path.dirname(parent),root]});return file;}
function add(id){if(modules.has(id))return;let code;if(id.startsWith('virtual:'))code=virtual[id.slice(8)];else if(local[path.relative(root,id)])code=local[path.relative(root,id)];else if(/\.(png|jpg)$/.test(id))code='module.exports="";';else if(id.endsWith('.json'))code='module.exports='+fs.readFileSync(id,'utf8')+';';else{code=fs.readFileSync(id,'utf8');if(/\.tsx?$/.test(id))code=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;}
 const deps={};modules.set(id,{code,deps});for(const m of code.matchAll(/\brequire\(['"]([^'"]+)['"]\)/g)){const next=resolve(m[1],id);deps[m[1]]=next;add(next);}}
const entry=path.join(root,'app/paywall.tsx'),provider=path.join(root,'src/context/SubscriptionContext.tsx');add(entry);add(provider);const react=resolve('react',entry),dom=resolve('react-dom/client',entry);add(react);add(dom);
const entries=[...modules].map(([id,{code,deps}])=>JSON.stringify(id)+':[function(require,module,exports){\n'+code+'\n},'+JSON.stringify(deps)+']').join(',\n');
const bundle=`const process={env:{NODE_ENV:'production'}};const __DEV__=false;const M={${entries}},C={};function load(id){if(C[id])return C[id].exports;const m=C[id]={exports:{}};M[id][0](name=>load(M[id][1][name]),m,m.exports);return m.exports;}
const R=load(${JSON.stringify(react)}),D=load(${JSON.stringify(dom)}),P=load(${JSON.stringify(provider)}),Screen=load(${JSON.stringify(entry)}).default;
const q=new URLSearchParams(location.search);window.billingMock={country:q.get('country')||'ESP',mode:q.get('mode')||'usd',productFetches:0,purchases:[],purchased:false};window.billingErrors=[];
function Probe(){window.billingContext=R.useContext(P.SubscriptionContext);return null;}D.createRoot(document.getElementById('root')).render(R.createElement(P.SubscriptionProvider,null,R.createElement(Screen),R.createElement(Probe)));`;
fs.writeFileSync(path.join(dir,'bundle.js'),bundle);fs.writeFileSync(path.join(dir,'index.html'),'<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#171717;color:#EEF3E1;font-family:Arial,sans-serif}button{font:inherit;color:inherit;border:0;background:none;text-align:inherit;cursor:pointer}button:disabled{cursor:default}#root>div{min-height:100vh}span{white-space:pre-wrap}</style><div id="root"></div><script src="bundle.js"></script>');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM});const page=await browser.newPage({viewport:{width:320,height:844},locale:'es-ES'});const errors=[];page.on('pageerror',e=>errors.push(e.message));try{
 await page.goto('file://'+path.join(dir,'index.html'));await page.getByRole('button',{name:'Ver precios',exact:true}).click();
 const annual=page.getByTestId('paywall-plan-yearly'),monthly=page.getByTestId('paywall-plan-monthly');await page.getByTestId('store-currency-notice').waitFor();
 assert.ok((await annual.innerText()).includes('14,99'));assert.ok((await monthly.innerText()).includes('4,99'));assert.ok((await annual.innerText()).includes('39,99'));
 assert.equal(await page.getByTestId('reference-label-yearly').innerText(),'Referencia para España');assert.ok(!(await page.locator('body').innerText()).includes('$12.99'));
 assert.equal(await monthly.getByTestId('annual-launch-label').count(),0);await page.screenshot({path:path.join(root,'../outputs/DJPlannerPro/paywall-spain-store-mismatch-320.png'),fullPage:true});
 await page.evaluate(()=>{window.billingMock.mode='eur';});await page.getByRole('button',{name:'Actualizar precios',exact:true}).click();await page.waitForFunction(()=>!window.billingContext.isLoading);
 assert.equal(await page.getByTestId('store-currency-notice').count(),0);assert.equal(await page.getByTestId('reference-label-yearly').count(),0);assert.equal(await page.getByTestId('annual-launch-label').innerText(),'Precio de lanzamiento');assert.ok((await annual.innerText()).includes('39,99'));
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(root,'../outputs/DJPlannerPro/paywall-spain-eur-launch-390.png'),fullPage:true});
 await page.evaluate(()=>{window.billingMock.country='USA';window.billingMock.mode='usd';});await page.getByRole('button',{name:'Actualizar precios',exact:true}).click();await page.waitForFunction(()=>!window.billingContext.isLoading);
 assert.ok((await annual.innerText()).includes('$12.99'));assert.equal(await page.getByTestId('annual-standard-price').count(),0);assert.equal(await page.getByTestId('store-currency-notice').count(),0);
 await page.evaluate(()=>{window.billingMock.country='ESP';window.billingMock.mode='standard';});await page.getByRole('button',{name:'Actualizar precios',exact:true}).click();await page.waitForFunction(()=>!window.billingContext.isLoading);
 assert.ok((await annual.innerText()).includes('39,99'));assert.equal(await page.getByTestId('annual-launch-label').count(),0);
 await page.evaluate(()=>{window.billingMock.mode='eur';});await page.getByRole('button',{name:'Actualizar precios',exact:true}).click();await page.waitForFunction(()=>!window.billingContext.isLoading);
 // An older currency response arriving late must not overwrite the new EUR quote.
 await page.evaluate(async()=>{
  const s=window.billingMock;s.deferProducts=true;s.productWaiters=[];s.mode='usd';const older=window.billingContext.refreshSubscriptionStatus();
  while(s.productWaiters.length<1)await new Promise(r=>setTimeout(r,0));
  s.mode='eur';const newer=window.billingContext.refreshSubscriptionStatus();while(s.productWaiters.length<2)await new Promise(r=>setTimeout(r,0));
  s.productWaiters[1]();await newer;s.productWaiters[0]();await older;s.deferProducts=false;
 });
 await page.waitForFunction(()=>window.billingContext.annualPackage?.product.currencyCode==='EUR'&&!window.billingContext.isLoading);
 // Returning from Apple's sheet while purchasing must not start a conflicting refresh.
 const fetches=await page.evaluate(()=>{window.billingMock.holdPurchase=true;return window.billingMock.productFetches;});
 await page.getByRole('button',{name:'Suscribirme a Pro',exact:true}).click();await page.waitForFunction(()=>window.billingMock.purchases.length===1);
 await page.evaluate(()=>window.billingAppActive());assert.equal(await page.evaluate(()=>window.billingMock.productFetches),fetches);
 await page.evaluate(()=>window.billingMock.finishPurchase());await page.waitForFunction(()=>window.billingContext.isPro===true&&!window.billingContext.isLoading);
 assert.deepEqual(await page.evaluate(()=>window.billingMock.purchases),[{id:'djplanner.pro.yearly',currency:'EUR',package:'$rc_annual'}]);assert.deepEqual(await page.evaluate(()=>window.billingErrors),[]);assert.deepEqual(errors,[]);
 console.log('PASS: actual paywall/provider/service; Spain USD discrepancy, EUR refresh, annual launch/standard, US account, late currency responses and purchase-sheet resume.');
 }catch(e){console.error(e);console.error((await page.locator('body').innerText()).slice(-4000));process.exitCode=1;}finally{await browser.close();}})();
