const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
let browser;
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM});
 const context=await browser.newContext({viewport:{width:390,height:844},locale:'es-ES',timezoneId:'Europe/Madrid'});
 const user={id:'00000000-0000-4000-8000-000000000901',aud:'authenticated',role:'authenticated',email:'fixture@example.invalid',app_metadata:{provider:'email'},user_metadata:{artist_name:'DJ Demo'}};
 const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const token=`${enc({alg:'HS256',typ:'JWT'})}.${enc({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})}.${enc('fixture')}`;
 const session={access_token:token,refresh_token:'fixture',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user};
 const profile={id:user.id,user_id:user.id,artist_name:'DJ Demo',city:'Sevilla',genres:'House',is_visible:true,avatar_url:'https://fixture.example/avatar.jpg'};
 await context.addInitScript(({session,profile})=>{
 Object.defineProperty(navigator,'language',{get:()=> 'es-ES'});Object.defineProperty(navigator,'languages',{get:()=>['es-ES']});
 localStorage.setItem('@theme','light');localStorage.setItem('sb-voyurnwckmateohuzbab-auth-token',JSON.stringify(session));localStorage.setItem('dj-auth-storage-v2',JSON.stringify({state:{session,user:session.user,profile,hasSeenOnboarding:true},version:0}));
 },{session,profile});
 const venues=[];let inserted=null,createdSession=null;
 await context.route('**/*.supabase.co/**',async route=>{
 const r=route.request(),url=new URL(r.url());let data=[];
 if(url.pathname.includes('/auth/v1/user'))data=user;
 else if(url.pathname.includes('/auth/v1/token'))data=session;
 else if(url.pathname.includes('/users_profile') || url.pathname.includes('/community_profiles')) data=profile;
 else if(url.pathname.includes('/get_session_usage') || url.pathname.includes('/subscription-access'))data={count:0,limit:30,remaining:30,isPro:false};
 else if(url.pathname.includes('/community_filter_options'))data={cities:[],genres:[]};
 else if(url.pathname.includes('/venues')){
 if(r.method()==='POST'){inserted=r.postDataJSON();const v={...inserted,id:'00000000-0000-4000-8000-000000000101',created_at:new Date().toISOString(),updated_at:new Date().toISOString()};venues.push(v);data=v;}else data=venues;
 }else if(url.pathname.includes('/create_session_series')){const input=r.postDataJSON().input;createdSession={...input,id:'00000000-0000-4000-8000-000000000201',user_id:user.id,venue_city:inserted.city,venue_address:inserted.address,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};data=createdSession;}
 else if(url.pathname.includes('/sessions')&&createdSession)data=url.searchParams.has('id')?createdSession:[createdSession];
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await context.route('**/photon.komoot.io/**',route=>route.fulfill({status:503,body:'Fixture offline'}));
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto('http://localhost:8081/add-session');
 await page.getByText('Ej: Club Amnesia',{exact:true}).click();
 await page.getByRole('button',{name:'Añadir lugar',exact:true}).click();
 await page.getByRole('textbox',{name:'Nombre del lugar',exact:true}).fill('Sala Test');
 assert(await page.getByRole('button',{name:'Añadir lugar',exact:true}).isDisabled());
 await page.getByRole('textbox',{name:'Ciudad *',exact:true}).fill('mAdRid');
 await page.getByRole('textbox',{name:'Dirección',exact:true}).fill('Calle privada 10');
 await page.screenshot({path:'/private/tmp/djplanner-location-sheet.png'});
 await page.getByRole('button',{name:'Añadir lugar',exact:true}).click();
 await page.getByText('Sala Test',{exact:true}).waitFor();
 assert.equal(inserted.city,'Madrid');assert.equal(inserted.address,'Calle privada 10');
 await page.getByRole('button',{name:'Guardar sesión',exact:true}).click();
 await page.waitForURL('**/session/**');
 assert.equal(createdSession.booking_timezone,'Europe/Madrid');assert.equal(createdSession.venue_id,venues[0].id);
 await page.getByText('Madrid',{exact:true}).waitFor();
 await page.getByText('Calle privada 10',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);console.log('PASS: city required, normalized manual fallback, session-linked venue, explicit event time zone and private detail location');
 await browser.close();
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1;});
