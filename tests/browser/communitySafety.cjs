const { chromium }=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let browser;const errors=[];
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM});
 const user={id:id(901),aud:'authenticated',role:'authenticated',email:'fixture@example.invalid',app_metadata:{provider:'email'},user_metadata:{artist_name:'DJ Demo'},created_at:'2026-10-01T12:00:00Z'};
 const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const session={access_token:`${enc({alg:'HS256',typ:'JWT'})}.${enc({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})}.${enc('fixture')}`,refresh_token:'fixture',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user};
 const profile={user_id:user.id,id:user.id,artist_name:'DJ Demo',city:'Madrid',genres:'House',bio:'Music first',avatar_url:'https://fixture.example/avatar.jpg',cover_url:null,is_visible:true};
 const target={...profile,user_id:id(902),id:id(902),artist_name:'DJ Pepe'};
 let accepted=false,blocked=false,reported=false,moderator=false,failReport=true,followed=false,reviewed=false,queueCalls=0;const actions=[];let profileSaves=0;
 const context=await browser.newContext({viewport:{width:390,height:844},locale:'es-ES'});
 await context.addInitScript(({session,profile})=>{localStorage.setItem('@theme','light');localStorage.setItem('sb-voyurnwckmateohuzbab-auth-token',JSON.stringify(session));localStorage.setItem('dj-auth-storage-v2',JSON.stringify({state:{session,user:session.user,profile,hasSeenOnboarding:true},version:0}));},{session,profile});
 await context.route('https://fixture.example/**',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#6554df"/></svg>'}));
 await context.route('**/*.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url());let body=[];
  if(url.pathname.includes('/auth/v1/user'))body=user;
  else if(url.pathname.includes('/auth/v1/token'))body=session;
  else if(url.pathname.endsWith('/community_safety')){
   const {action,input}=req.postDataJSON();actions.push({action,input});
   if(action==='status')body={version:'2026-10-09',accepted,moderator,restricted:false,contact:'support@example.invalid'};
   else if(action==='accept'){assert.equal(input.version,'2026-10-09');accepted=true;body={accepted:true};}
   else if(action==='report'){
    assert.equal(input.target_id,target.user_id);
    if(failReport){failReport=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Fixture unavailable'})});return;}
    reported=true;body={id:id(910)};
   }else if(action==='block'){assert.equal(input.user_id,target.user_id);blocked=true;followed=false;body={blocked:true};}
   else if(action==='unblock'){blocked=false;body={blocked:false};}
   else if(action==='blocked')body=blocked?[{user_id:target.user_id,artist_name:target.artist_name,avatar_url:null}]:[];
   else if(action==='queue'){queueCalls++;assert(moderator);body=reviewed?[]:[{id:id(910),kind:'profile',target_id:target.user_id,author_id:target.user_id,reason:'spam',details:'Public content only',snapshot:{name:target.artist_name,bio:'Spam evidence'},status:'open',created_at:'2026-10-09T12:00:00Z'}];}
   else if(action==='review'){assert(moderator);assert.equal(input.outcome,'remove');assert(input.note.length>=3);reviewed=true;body={reviewed:true};}
  }else if(url.pathname.endsWith('/save_unified_profile')){
   assert(accepted,'profile must not save before consent');profileSaves++;const {input}=req.postDataJSON();Object.assign(profile,input);body={profile,community:profile};
  }else if(url.pathname.includes('/community_profiles'))body=url.searchParams.get('user_id')===`eq.${target.user_id}` ? blocked||reported?null:target : profile;
  else if(url.pathname.includes('/users_profile'))body=profile;
  else if(url.pathname.includes('/subscription-access'))body={count:2,limit:30,remaining:28,isPro:false};
  else if(url.pathname.endsWith('/community_follows')){
   if(req.method()==='POST'){assert(accepted,'cannot follow before accepting');followed=true;body=null;}
   else body=followed?[{following_id:target.user_id}]:[];
  }else if(url.pathname.endsWith('/community_discover_filtered'))body=blocked||reported?[]:[target];
  else if(url.pathname.endsWith('/community_filter_options'))body={cities:['Madrid'],genres:['House']};
  else if(req.method()==='HEAD'){await route.fulfill({status:200,headers:{'content-range':'0-0/0'},body:''});return;}
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 // Native sheet uses a local, inline consent surface: cancel releases the
 // pending save without losing fields, and acceptance completes the same save.
 await page.goto('http://localhost:8081/edit-dj-profile?setup=1');
 await page.getByRole('button',{name:'Publicar perfil y entrar',exact:true}).click();
 await page.getByText('Antes de publicar',{exact:true}).waitFor();
 assert.equal(profileSaves,0);
 await page.getByRole('button',{name:'Cancelar',exact:true}).filter({hasText:'Cancelar'}).click();
 await page.getByText('Antes de publicar',{exact:true}).waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Publicar perfil y entrar',exact:true}).click();
 await page.getByRole('checkbox').click();
 await page.getByRole('button',{name:'Aceptar y continuar',exact:true}).click();
 await page.waitForURL('**/community');
 assert.equal(profileSaves,1,'one save after accepting, no loop');
 accepted=false;
 await page.goto(`http://localhost:8081/community/${target.user_id}`);
 await page.getByRole('button',{name:'Seguir',exact:true}).click();
 await page.getByText('Antes de publicar',{exact:true}).waitFor();
 assert(!accepted);await page.getByRole('checkbox').click();await page.getByRole('button',{name:'Aceptar y continuar'}).click();
 await page.getByRole('button',{name:'Dejar de seguir',exact:true}).waitFor();assert(accepted && followed);
 await page.getByRole('button',{name:'Opciones',exact:true}).click();await page.getByRole('button',{name:'Denunciar',exact:true}).click();
 await page.getByRole('radio',{name:'Spam o fraude',exact:true}).click();await page.getByRole('button',{name:'Enviar denuncia'}).click();
 await page.getByText('No se ha podido completar. Inténtalo de nuevo.',{exact:true}).waitFor();assert(!reported);
 await page.screenshot({path:'/private/tmp/djplanner-report-sheet.png'});
 await page.getByRole('button',{name:'Enviar denuncia'}).click();await page.getByText('Denuncia enviada',{exact:true}).waitFor();await page.getByRole('button',{name:'Entendido'}).click();
 await page.waitForURL('**/community');assert(reported);
 reported=false;await page.goto(`http://localhost:8081/community/${target.user_id}`);
 await page.getByRole('button',{name:'Opciones',exact:true}).click();await page.getByRole('button',{name:'Bloquear DJ',exact:true}).click();await page.getByRole('button',{name:'Bloquear DJ',exact:true}).click();await page.waitForURL('**/community');assert(blocked);
 await page.goto('http://localhost:8081/community-safety');await page.getByText('DJ Pepe',{exact:true}).waitFor();await page.getByRole('button',{name:'Desbloquear',exact:true}).click();await page.getByText('No has bloqueado a ningún DJ.',{exact:true}).waitFor();assert(!blocked && !followed);
 await page.goto('http://localhost:8081/moderation');await page.getByText('Solo el equipo de moderación puede acceder.',{exact:true}).waitFor();assert.equal(queueCalls,0);
 moderator=true;await page.reload();await page.getByText('Spam evidence',{exact:true}).waitFor();await page.getByRole('textbox',{name:'Motivo de la decisión (obligatorio)'}).fill('Revisado: spam confirmado');await page.getByRole('button',{name:'Retirar contenido',exact:true}).click();await page.getByText('No hay denuncias en esta bandeja.',{exact:true}).waitFor();assert(reviewed);
 await page.setViewportSize({width:320,height:844});await page.goto('http://localhost:8081/community-safety');await page.getByText('DJs bloqueados',{exact:true}).waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS: profile consent cancellation and successful save, consent before following, failed report retained and retried, report acknowledgement, blocking, unblock without re-follow, unauthorized moderator access denied, review workflow, 320px layout and no runtime errors.');
 await browser.close();
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1;});
