const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs');const assert=require('node:assert/strict');
const root=process.cwd();let browser,latestPage,errors=[];
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM});
 const user={id:'00000000-0000-4000-8000-000000000901',aud:'authenticated',role:'authenticated',email:'fixture@example.invalid',app_metadata:{provider:'email'},user_metadata:{artist_name:'DJ Demo'},created_at:'2026-10-01T12:00:00Z'};
 const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const token=`${enc({alg:'HS256',typ:'JWT'})}.${enc({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})}.${enc('fixture')}`;
 const session={access_token:token,refresh_token:'fixture',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user};
 const profile={user_id:user.id,artist_name:'DJ Demo',city:'Madrid',genres:'House · Disco',bio:'Sesiones con identidad, de la primera mezcla al último tema.',avatar_url:null,cover_url:null,is_visible:true,mixcloud_url:'https://www.mixcloud.com/demo/',soundcloud_url:null,instagram_url:null};
 const id='00000000-0000-4000-8000-000000000991';
 const req={id,owner_id:user.id,promoter_name:'Promotor Demo',promoter_email:'promoter@example.invalid',event_title:'Opening Night',venue:'Club Demo',city:'Madrid',date:'2027-06-01',start_time:'22:00',end_time:'04:00',budget:500,currency:'EUR',timezone:'Europe/Madrid',state:'new',latest_proposal_id:null,session_id:null,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
 let thread={request:{...req},messages:[{id:'m1',sender:'promoter',body:'Equipo incluido. Nos gustaría una sesión de House.',created_at:new Date().toISOString()}],proposals:[]};
 let enquiries=0,accepts=0;
 async function setup(lang='es',width=390,dark=false,auth=false,ready=true){
  const context=await browser.newContext({viewport:{width,height:844},locale:lang,colorScheme:dark?'dark':'light'});
  await context.addInitScript(({lang,dark,auth,session,profile})=>{Object.defineProperty(navigator,'language',{get:()=>lang});Object.defineProperty(navigator,'languages',{get:()=>[lang]});localStorage.setItem('@theme',dark?'dark':'light');if(auth){localStorage.setItem('sb-voyurnwckmateohuzbab-auth-token',JSON.stringify(session));localStorage.setItem('dj-auth-storage-v2',JSON.stringify({state:{session,user:session.user,profile:{...profile,id:session.user.id},hasSeenOnboarding:true},version:0}));}}, {lang,dark,auth,session,profile});
  await context.route('**/*.supabase.co/**',async route=>{
   const request=route.request(),url=new URL(request.url());let body=[];
   if(url.pathname.includes('/booking-gateway')){
    const {action,input={}}=request.postDataJSON();
    if(action==='profile')body={profile,sessions:[{id:'s1',title:'Disco Night',venue:'Sala Demo',date:'2026-09-01'}],timezone:'Europe/Madrid'};
    else if(action==='request'){enquiries++;assert.ok(input.submission_key);assert.equal(input.promoter_email,'promoter@example.invalid');body={sent:true};}
    else if(action==='owner_status')body={settings:{slug:'dj-demo',enabled:ready,timezone:'Europe/Madrid',default_terms:'Equipo proporcionado por la sala.'},profile,isPro:true,serviceReady:ready,webOrigin:ready?'https://fixture.example.invalid':null};
    else if(action==='owner_settings'){assert.ok(input.slug);body=input;}
    else if(action==='owner_read'||action==='verify'||action==='read')body=thread;
    else if(action==='owner_propose'){const p={...input,id:'p'+(thread.proposals.length+1),version:thread.proposals.length+1,timezone:'Europe/Madrid',expires_at:new Date(Date.now()+48*3600000).toISOString(),hold_until:input.hold?new Date(Date.now()+48*3600000).toISOString():null};thread={...thread,request:{...thread.request,state:'proposed',latest_proposal_id:p.id},proposals:[...thread.proposals,p]};body=thread;}
    else if(action==='accept'){assert.equal(input.proposal_id,thread.request.latest_proposal_id);accepts++;thread={...thread,request:{...thread.request,state:'accepted',session_id:'00000000-0000-4000-8000-000000000999'}};body=thread;}
    else if(action.endsWith('message')||action==='changes'){thread={...thread,messages:[...thread.messages,{id:'m'+(thread.messages.length+1),sender:action.startsWith('owner_')?'dj':'promoter',body:input.body,created_at:new Date().toISOString()}]};body=thread;}
    else throw Error('Unhandled mock action '+action);
   }else if(url.pathname.includes('/auth/v1/user'))body=user;
   else if(url.pathname.includes('/auth/v1/token'))body=session;
   else if(url.pathname.includes('/community_profiles'))body=profile;
   else if(url.pathname.includes('/users_profile'))body={id:user.id,artist_name:profile.artist_name,avatar_url:null};
   else if(url.pathname.includes('/booking_requests'))body=[req];
   else if(url.pathname.includes('/subscription-access')||url.pathname.includes('/get_session_usage'))body={count:0,limit:30,remaining:30,isPro:true};
   else if(url.pathname.includes('/notifications')&&request.method()==='HEAD'){await route.fulfill({status:200,headers:{'content-range':'0-0/0'},body:''});return;}
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  const page=await context.newPage();latestPage=page;page.on('pageerror',e=>errors.push(e.message));return {page,context};
 }
 let {page,context}=await setup();
 await page.goto('http://localhost:8081/book/dj-demo');await page.getByRole('button',{name:'Consultar disponibilidad',exact:true}).waitFor();
 await page.screenshot({path:'/private/tmp/djplanner-booking-public.png'});
 await page.getByRole('button',{name:'Consultar disponibilidad',exact:true}).click();
 await page.getByRole('textbox',{name:'Tu nombre',exact:true}).fill('Promotor Demo');await page.getByRole('textbox',{name:'Correo de contacto',exact:true}).fill('promoter@example.invalid');await page.getByRole('textbox',{name:'Nombre del evento',exact:true}).fill('Closing Night');await page.getByRole('textbox',{name:'Lugar',exact:true}).fill('Club Demo');await page.getByRole('textbox',{name:'Ciudad',exact:true}).fill('Madrid');await page.getByRole('textbox',{name:'Presupuesto total',exact:true}).fill('500');
 await page.getByRole('button',{name:'Elegir fecha',exact:true}).click();
 await page.getByRole('button').filter({hasText:/^5$/}).click();await page.getByRole('button',{name:'Enviar consulta',exact:true}).click();await page.getByText('Revisa tu correo',{exact:true}).waitFor();assert.equal(enquiries,1);
 await page.screenshot({path:'/private/tmp/djplanner-booking-enquiry.png',fullPage:true});
 await context.close();
 ({page,context}=await setup('es',390,false,true));
 await page.goto('http://localhost:8081/bookings');await page.getByRole('button',{name:'Editar enlace y condiciones',exact:true}).waitFor();await page.screenshot({path:'/private/tmp/djplanner-booking-workspace.png'});
 await page.getByRole('button',{name:'Abrir conversación',exact:true}).click();await page.getByRole('button',{name:'Preparar propuesta',exact:true}).waitFor();await page.getByRole('button',{name:'Preparar propuesta',exact:true}).click();await page.getByRole('textbox',{name:'Caché total',exact:true}).fill('750');await page.getByRole('textbox',{name:'Condiciones de esta propuesta',exact:true}).fill('Equipo y transporte incluidos.');await page.getByRole('switch',{name:'Bloquear temporalmente la fecha',exact:true}).check();await page.getByRole('button',{name:'Enviar propuesta',exact:true}).click();await page.getByText('Propuesta · versión 1',{exact:true}).waitFor();await page.screenshot({path:'/private/tmp/djplanner-booking-proposal.png'});await context.close();
 ({page,context}=await setup());await page.goto('http://localhost:8081/booking/'+id+'#access='+'a'.repeat(64));await page.getByRole('button',{name:'Revisar y aceptar',exact:true}).waitFor();await page.waitForFunction(()=>location.hash==='');assert.equal(await page.evaluate(()=>location.hash),'');await page.screenshot({path:'/private/tmp/djplanner-booking-promoter-proposal.png'});await page.getByRole('button',{name:'Revisar y aceptar',exact:true}).click();await page.getByRole('button',{name:'Confirmar acuerdo',exact:true}).click();await page.getByText('Acuerdo confirmado',{exact:true}).last().waitFor();assert.equal(accepts,1);await context.close();
 for(const lang of ['es','en','de','fr','it','pt','ja']){
  const copy=JSON.parse(fs.readFileSync(root+'/src/i18n/languages/'+lang+'.json')).bookings;
  ({page,context}=await setup(lang,320,true));await page.goto('http://localhost:8081/book/dj-demo');await page.getByRole('button',{name:copy.enquire,exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,lang+' overflow');assert.equal((await page.locator('body').innerText()).includes('bookings.'),false,lang+' key leak');await context.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS public enquiry form, owner proposal, private fragment, explicit acceptance, seven languages at 320 px. All external requests mocked.');await browser.close();
})().catch(async e=>{console.error(e);console.error('page errors',errors);if(latestPage){console.error(await latestPage.locator('body').innerText());console.error(await latestPage.evaluate(()=>({href:location.href,keys:Object.keys(sessionStorage)})));await latestPage.screenshot({path:'/private/tmp/djplanner-booking-debug.png'});}if(browser)await browser.close();process.exit(1)});
