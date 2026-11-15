const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
const moduleUnderTest={exports:{}};new Function('module','exports',ts.transpileModule(fs.readFileSync('supabase/functions/poster-ai/domain.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(moduleUnderTest,moduleUnderTest.exports);
const {validateInput,buildPrompt,OWNER}=moduleUnderTest.exports;
const id='12345678-1234-4234-8234-123456789012';
function input(){return {id,sessionId:id,parentId:null,form:{title:'Sesión larga',djs:['Manuel Parra'],date:'2026-12-24',time:'23:30',venue:'Sala Órbita',format:'Cartel',style:'Retrato Editorial'},instruction:'',photos:[]};}
test('bounded event input and no-photo prompt never invent an artist identity',()=>{const data=validateInput(input());const prompt=buildPrompt(data);assert.match(prompt,/Do not invent faces/);assert.match(prompt,/Manuel Parra/);assert.match(prompt,/1024x1536/);});
test('reject arbitrary format/model cost overrides, invalid dates, oversized photos and missing edit instruction',()=>{
 for(const patch of [{form:{...input().form,format:'8000x8000'}},{form:{...input().form,date:'2026-02-30'}},{photos:[{name:'Manuel Parra',dataUrl:'https://example.com/image.jpg'}]},{parentId:id}])assert.throws(()=>validateInput({...input(),...patch}));
 const normalized=validateInput({...input(),model:'expensive-model',n:999});assert.equal(normalized.model,undefined);assert.equal(normalized.n,undefined);
});
test('editing uses previous version as image 2 and preserves unrelated event data',()=>{const data=validateInput({...input(),parentId:id,instruction:'Pon el fondo gris'});assert.match(buildPrompt(data),/Image 2 is the existing user poster/);assert.match(buildPrompt(data),/Pon el fondo gris/);});
test('budget is atomic, idempotent, durable after failure and inaccessible to clients',async t=>{
 const {PGlite}=require('@electric-sql/pglite');const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create schema account_private;create table storage.objects(bucket_id text,name text);create function account_private.work(text,uuid) returns jsonb language sql as 'select null::jsonb';create function account_private.finalize_guard() returns trigger language plpgsql as 'begin return old; end';create table auth.users(id uuid primary key);create table public.sessions(id uuid primary key,user_id uuid,date date,start_time text,status text,booking_timezone text);create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create function account_private.active_user(target uuid) returns boolean language sql security definer as 'select exists(select 1 from auth.users where id=target)';insert into auth.users values('${OWNER}');insert into public.sessions values('${id}','${OWNER}','2099-12-24','23:30','confirmed','Europe/Madrid');`);
 await db.exec(fs.readFileSync('supabase/migrations/20261018235804_poster_ai_private_beta.sql','utf8'));
 const reserve=(job,hash='hash',user=OWNER)=>db.query('select public.reserve_poster_ai_job($1,$2,$3,null,$4,$5,null) as result',[job,user,id,hash,JSON.stringify(input().form)]);
 await t.test('disabled beta cannot reserve',async()=>{await assert.rejects(reserve(id),/poster_disabled/);});
 await db.exec(`grant usage on schema account_private to service_role;grant select on public.sessions to service_role;update public.poster_ai_budget set enabled=true;set role service_role;`);
 await t.test('same request retries do not spend twice; changed content conflicts',async()=>{const first=await reserve(id);assert.equal(first.rows[0].result.created,true);assert.equal((await reserve(id)).rows[0].result.created,false);await assert.rejects(reserve(id,'different'),/poster_id_conflict/);});
 await db.exec('reset role');
 await t.test('second active request and foreign accounts cannot reserve',async()=>{await assert.rejects(reserve('22345678-1234-4234-8234-123456789012'),/poster_busy/);await assert.rejects(reserve(id,'hash','33345678-1234-4234-8234-123456789012'),/poster_forbidden/);});
 await t.test('unknown outcome blocks more calls even after reconnect',async()=>{await db.exec(`update public.poster_ai_jobs set status='uncertain';`);await assert.rejects(reserve('22345678-1234-4234-8234-123456789012'),/poster_busy/);});
 await t.test('failed call keeps its reserve; the third attempt is blocked',async()=>{await db.exec(`update public.poster_ai_jobs set status='failed';`);await reserve('22345678-1234-4234-8234-123456789012');await db.exec(`update public.poster_ai_jobs set status='failed';`);await assert.rejects(reserve('32345678-1234-4234-8234-123456789012'),/poster_budget_exhausted/);const {rows}=await db.query('select reserved_eur_cents,attempts from public.poster_ai_budget');assert.deepEqual(rows[0],{reserved_eur_cents:500,attempts:2});});
 await t.test('client cannot modify budget or call privileged RPC',async()=>{await db.exec('set role authenticated');await assert.rejects(db.query('select * from public.poster_ai_budget'),/permission denied/);await assert.rejects(reserve(id),/permission denied/);await db.exec('reset role');});
 await db.close();
});
test('Headliner accepts the approved style and uses a distinct full-portrait design system',()=>{
 const headliner=validateInput({...input(),form:{...input().form,style:'Headliner'}});
 const prompt=buildPrompt(headliner);
 assert.match(prompt,/Headliner festival campaign/);
 assert.match(prompt,/No segmented panels/);
 assert.doesNotMatch(prompt,/Staggered vertical photo windows/);
 assert.match(buildPrompt(validateInput(input())),/Staggered vertical photo windows/);
 assert.throws(()=>validateInput({...input(),form:{...input().form,style:'Unknown'}}));
});
test('Rave Industrial uses its own architecture/collage direction with and without portraits',()=>{
 const rave=validateInput({...input(),form:{...input().form,style:'Rave Industrial'}});
 const prompt=buildPrompt(rave);
 assert.match(prompt,/Rave Industrial underground club print/);
 assert.match(prompt,/phosphor green monochrome/);
 assert.match(prompt,/industrial architectural imagery/);
 assert.match(prompt,/Do not invent faces/);
 assert.doesNotMatch(prompt,/Design system: Headliner festival campaign/);
 assert.match(prompt,/If artist photos are supplied, integrate recognisable/);
});
test('Disco Collage uses its approved warm print direction and preserves photo identities',()=>{
 const disco=validateInput({...input(),form:{...input().form,style:'Disco Collage'}});
 const prompt=buildPrompt(disco);
 assert.match(prompt,/Disco Collage, a collectible 1970s/);
 assert.match(prompt,/screen-print halftones/);
 assert.match(prompt,/preserve recognisable real faces/);
 assert.match(prompt,/Without photos use an original vinyl/);
 assert.match(prompt,/Do not invent faces/);
 assert.doesNotMatch(prompt,/Design system: Rave Industrial/);
});

test('creation accepts three portrait references, preserves initial instructions and rejects a fourth or foreign artist',()=>{
 const jpeg=Buffer.from([255,216,255,192,0,11,8,0,32,0,32,1,1,17,0]).toString('base64');
 const photo={name:'Manuel Parra',dataUrl:`data:image/jpeg;base64,${jpeg}`};
 const data=validateInput({...input(),instruction:'Fondo azul con letras grandes',photos:[photo,photo,photo]});
 assert.equal(data.photos.length,3);assert.match(buildPrompt(data),/Fondo azul con letras grandes/);
 assert.throws(()=>validateInput({...input(),photos:[photo,photo,photo,photo]}));
 assert.throws(()=>validateInput({...input(),photos:[{...photo,name:'Otro artista'}]}));
});
test('Impacto Amarillo accepts every format and keeps its urban yellow design and identity rules',()=>{
 for(const format of ['Cartel','Historia','Cuadrado']){
  const data=validateInput({...input(),form:{...input().form,style:'Impacto Amarillo',format}});
  const prompt=buildPrompt(data);
  assert.match(prompt,/Design system: Impacto Amarillo/);
  assert.match(prompt,/sunshine-yellow inset rectangular frame/);
  assert.match(prompt,/preserve actual facial identity/);
  assert.match(prompt,/never invent named artist faces/);
  assert.match(prompt,/government emblems/);
  assert.match(prompt,/Manuel Parra/);
 }
 const source=fs.readFileSync('supabase/functions/poster-ai/index.ts','utf8');
 assert.match(source,/style==='Impacto Amarillo'\?impactoAmarilloReference/);
 const reference=fs.readFileSync('supabase/functions/poster-ai/impacto-amarillo-reference.ts','utf8');
 const bytes=Buffer.from(reference.match(/base64,([^']+)/)[1],'base64');
 assert.equal(bytes.subarray(0,3).toString('hex'),'ffd8ff');
});
test('Coral Manifesto accepts all formats and preserves identity with its own reference',()=>{
 for(const format of ['Cartel','Historia','Cuadrado']){
  const data=validateInput({...input(),form:{...input().form,style:'Coral Manifesto',format}});
  const prompt=buildPrompt(data);
  assert.match(prompt,/Design system: Coral Manifesto/);
  assert.match(prompt,/salmon-coral paper/);
  assert.match(prompt,/halftone photographic cutouts/);
  assert.match(prompt,/preserve actual facial identity/);
  assert.match(prompt,/never invent named artist faces/);
  assert.match(prompt,/Manuel Parra/);
 }
 assert.match(fs.readFileSync('supabase/functions/poster-ai/index.ts','utf8'),/style==='Coral Manifesto'\?coralManifestoReference/);
 const reference=fs.readFileSync('supabase/functions/poster-ai/coral-manifesto-reference.ts','utf8');
 assert.equal(Buffer.from(reference.match(/base64,([^']+)/)[1],'base64').subarray(0,3).toString('hex'),'ffd8ff');
});
test('Offset Radical accepts every format and preserves identity and text through offset treatment',()=>{
 for(const format of ['Cartel','Historia','Cuadrado']){
  const data=validateInput({...input(),form:{...input().form,style:'Offset Radical',format}});
  const prompt=buildPrompt(data);
  assert.match(prompt,/Design system: Offset Radical/);
  assert.match(prompt,/misregistered cyan and hot-magenta/);
  assert.match(prompt,/preserve actual facial identity/);
  assert.match(prompt,/never invent named artist faces/);
  assert.match(prompt,/never obscure required lettering/);
  assert.match(prompt,/Manuel Parra/);
 }
 assert.match(fs.readFileSync('supabase/functions/poster-ai/index.ts','utf8'),/style==='Offset Radical'\?offsetRadicalReference/);
 const reference=fs.readFileSync('supabase/functions/poster-ai/offset-radical-reference.ts','utf8');
 assert.equal(Buffer.from(reference.match(/base64,([^']+)/)[1],'base64').subarray(0,3).toString('hex'),'ffd8ff');
});

test('Pulso accepts all formats with original geometry and exact session data',()=>{
 for(const format of ['Cartel','Historia','Cuadrado']){
  const value=validateInput({...input(),form:{...input().form,style:'Pulso',format}});
  const prompt=buildPrompt(value);
  assert.match(prompt,/Design system: Pulso/);
  assert.match(prompt,/Sesión larga/);
  assert.match(prompt,/Manuel Parra/);
  assert.match(prompt,/rectangular bars/);
  assert.doesNotMatch(prompt,/FRECUENCIA LIBRE|NORA VELA|SALA PRISMA/);
 }
 const source=fs.readFileSync('supabase/functions/poster-ai/index.ts','utf8');assert.match(source,/style==='Pulso'\?pulsoReference/);
 const reference=fs.readFileSync('supabase/functions/poster-ai/pulso-reference.ts','utf8');assert.equal(Buffer.from(reference.match(/base64,([^']+)/)[1],'base64').subarray(0,3).toString('hex'),'ffd8ff');
});

test('Pulso keeps one waveform for zero to three photos and groups same-artist references',()=>{
 const jpeg=Buffer.from([255,216,255,192,0,11,8,0,32,0,32,1,1,17,0]).toString('base64');
 const names=['Nora Vela','Álex Nox','Mara Sol'];
 for(let n=0;n<=3;n++){
  const photos=names.slice(0,n).map(name=>({name,dataUrl:`data:image/jpeg;base64,${jpeg}`}));
  const data=validateInput({...input(),form:{...input().form,style:'Pulso',djs:names},photos});
  const prompt=buildPrompt(data);assert.match(prompt,/EXACTLY ONE horizontal waveform/);assert.match(prompt,/STYLE FAMILY, NOT a fixed layout/);assert.match(prompt,/DISTINCT composition/);
  assert.equal((prompt.match(/is the real portrait of artist/g)||[]).length,n);
  if(n===0){assert.match(prompt,/No photos: keep the reference single-wave/);assert.doesNotMatch(prompt,/create atmospheric architectural\/light imagery/);}
  else{assert.match(prompt,new RegExp(`Use the ${n} supplied photo references for ${n} named artist identities`));assert.match(prompt,/never cover faces or required text/);}
 }
 const photo={name:names[0],dataUrl:`data:image/jpeg;base64,${jpeg}`};
 const prompt=buildPrompt(validateInput({...input(),form:{...input().form,style:'Pulso',djs:names},photos:[photo,photo,photo]}));
 assert.match(prompt,/3 supplied photo references for 1 named artist identities/);assert.match(prompt,/one clear head-and-shoulders portrait/);assert.match(prompt,/never extra artists or repeated people/);
});

test('Pulso edits retain existing portraits instead of applying the no-photo creation rule',()=>{
 const data=validateInput({...input(),parentId:id,instruction:'Cambiar el tamaño de la fecha',form:{...input().form,style:'Pulso'}});const prompt=buildPrompt(data);assert.match(prompt,/Preserve all real artist portraits and identities already present in Image 2/);assert.doesNotMatch(prompt,/No photos: keep the reference single-wave/);
});
