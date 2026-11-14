const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const ts=require('typescript');const {generateKeyPairSync,verify}=require('node:crypto');
function load(name,dependencies={}){const m={exports:{}};new Function('module','exports','require',ts.transpileModule(fs.readFileSync(`supabase/functions/poster-ai/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(m,m.exports,p=>{if(!(p in dependencies))throw Error('Unexpected import '+p);return dependencies[p];});return m.exports;}
const domain=load('domain');const provider=load('provider',{'./domain.ts':domain});
const keys=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
const account={project_id:provider.GOOGLE_PROJECT,client_email:`posters@${provider.GOOGLE_PROJECT}.iam.gserviceaccount.com`,private_key:keys.privateKey};
const env={POSTER_AI_PROVIDER:'vertex',POSTER_GOOGLE_TRIAL_CONFIRMED:'true',POSTER_GOOGLE_SERVICE_ACCOUNT_JSON:JSON.stringify(account)};
const now=Date.parse('2026-10-23T12:00:00Z');
const config=()=>provider.providerConfig(k=>env[k],now);
const id='12345678-1234-4234-8234-123456789012';
const input=()=>({id,sessionId:id,parentId:null,form:{title:'Sesión',djs:['Manuel'],date:'2026-12-24',time:'23:30',venue:'Sala',format:'Cartel',style:'Headliner'},instruction:'',photos:[]});
const jpeg='data:image/jpeg;base64,/9j/';
test('Google configuration is bound to Bothside, expires and never falls back to a saved OpenAI key',()=>{
 assert.equal(config().provider,'vertex');
 assert.throws(()=>provider.providerConfig(k=>k==='POSTER_OPENAI_API_KEY'?'old-key':undefined,now),/poster_not_configured/);
 for(const patch of [{POSTER_GOOGLE_SERVICE_ACCOUNT_JSON:''},{POSTER_GOOGLE_TRIAL_CONFIRMED:''},{POSTER_AI_PROVIDER:'unknown'},
   {POSTER_GOOGLE_SERVICE_ACCOUNT_JSON:JSON.stringify({...account,project_id:'dj-planner-512400'})},
   {POSTER_GOOGLE_SERVICE_ACCOUNT_JSON:JSON.stringify({...account,client_email:'other@example.com'})}]){
   assert.throws(()=>provider.providerConfig(k=>({...env,POSTER_OPENAI_API_KEY:'saved-old-key',...patch})[k],now),/poster_not_configured/);
 }
 assert.throws(()=>provider.providerConfig(k=>env[k],provider.GOOGLE_TRIAL_END),/poster_trial_expired/);
});
test('server authorization signs a one-hour JWT for Google, with no user impersonation or arbitrary token URL',async()=>{
 let calls=0;
 const token=await provider.googleAccessToken({...account,token_uri:'https://untrusted.example'},async(url,options)=>{
   calls++;assert.equal(url,'https://oauth2.googleapis.com/token');
   const assertion=options.body.get('assertion');const parts=assertion.split('.');
   assert.equal(verify('RSA-SHA256',Buffer.from(parts.slice(0,2).join('.')),keys.publicKey,Buffer.from(parts[2],'base64url')),true);
   const claims=JSON.parse(Buffer.from(parts[1],'base64url'));
   assert.equal(claims.iss,account.client_email);assert.equal(claims.aud,url);
   assert.equal(claims.exp-claims.iat,3600);assert.equal(claims.sub,undefined);
   assert.equal(options.body.get('grant_type'),'urn:ietf:params:oauth:grant-type:jwt-bearer');
   return Response.json({access_token:'server-only-token'});
 },now);
 assert.equal(token,'server-only-token');assert.equal(calls,1);
});
test('one bounded Google request keeps reference, previous poster and three named artist photos in order for every format',async()=>{
 for(const [format,ratio] of [['Cartel','2:3'],['Historia','9:16'],['Cuadrado','1:1']]){
   const data={...input(),parentId:id,instruction:'Fondo azul',photos:Array.from({length:3},()=>({name:'Manuel',dataUrl:jpeg}))};data.form.format=format;
   let authCalls=0;
   const request=await provider.providerRequest(config(),data,Array.from({length:5},()=>({image_url:jpeg})),async()=>{authCalls++;return Response.json({access_token:'token'});});
   assert.equal(authCalls,1);assert.match(request.url,/aiplatform.googleapis.com\/v1\/projects\/dj-planner-512422\/locations\/global\/publishers\/google\/models\/gemini-3.1-flash-image:generateContent$/);
   assert.equal(request.headers.Authorization,'Bearer token');
   const body=JSON.parse(request.body);assert.equal(body.contents[0].parts.length,6);
   const prompt=body.contents[0].parts[0].text;
   assert.match(prompt,/Image 2 is the existing user poster/);assert.match(prompt,/Image 5 is the real portrait/);
   assert.match(prompt,/Fondo azul/);assert.doesNotMatch(prompt,/1024x1536/);
   assert.equal(body.generationConfig.imageConfig.aspectRatio,ratio);
   assert.deepEqual(body.generationConfig.imageConfig.imageOutputOptions,{mimeType:'image/jpeg',compressionQuality:90});
   assert.equal(body.generationConfig.imageConfig.outputMimeType,undefined);
   assert.equal(body.generationConfig.imageConfig.outputCompressionQuality,undefined);
   assert.equal(body.generationConfig.imageConfig.imageSize,'1K');assert.equal(body.generationConfig.candidateCount,1);
   assert.equal(body.generationConfig.maxOutputTokens,4096);assert.equal(body.tools,undefined);
 }
});
test('auth rejection has one attempt and never makes an image request',async()=>{
 let calls=0;await assert.rejects(provider.providerRequest(config(),input(),[{image_url:jpeg}],async()=>{calls++;return new Response('',{status:403});}),/poster_provider_key/);assert.equal(calls,1);
 await assert.rejects(provider.providerRequest(config(),input(),[{image_url:jpeg}],async()=>{throw Error('network down');}),/poster_provider_key/);
});
test('Google metering preserves raw counters; output ignores thought images and validates file bytes and MIME',()=>{
 const usage={promptTokenCount:4000,totalTokenCount:5500,candidatesTokenCount:1120,thoughtsTokenCount:380};
 const png=Buffer.from([137,80,78,71,13,10,26,10]).toString('base64');
 const result={usageMetadata:usage,candidates:[{content:{parts:[{text:'done'},{thought:true,inlineData:{mimeType:'image/png',data:png}},{inlineData:{mimeType:'image/png',data:png}}]}}]};
 assert.deepEqual(provider.providerUsage(config(),result),{_provider:'vertex',_model:'gemini-3.1-flash-image',usageMetadata:usage});
 const out=provider.providerOutput(config(),result);assert.equal(out.mime,'image/png');assert.equal(out.extension,'png');assert.equal(out.bytes.length,8);
 for(const value of [{candidates:[]},{candidates:[{content:{parts:[{text:'blocked'}]}}]},
   {candidates:[{content:{parts:[{inlineData:{mimeType:'image/jpeg',data:png}}]}}]},
   {candidates:[{content:{parts:[{inlineData:{mimeType:'image/svg+xml',data:png}}]}}]}])assert.throws(()=>provider.providerOutput(config(),value),/poster_invalid_output/);
});
test('existing OpenAI configuration still builds its original single-call JPEG request',async()=>{
 const conf=provider.providerConfig(k=>({POSTER_AI_PROVIDER:'openai',POSTER_OPENAI_API_KEY:'existing-key'})[k],now);
 const request=await provider.providerRequest(conf,input(),[{image_url:jpeg}],()=>{throw Error('No auth network expected');});
 const body=JSON.parse(request.body);assert.equal(body.model,domain.MODEL);assert.equal(body.n,1);assert.equal(body.quality,'high');assert.equal(body.size,'1024x1536');
 assert.deepEqual(provider.providerUsage(conf,{usage:{output_tokens:10}}),{output_tokens:10});
 assert.equal(provider.providerOutput(conf,{data:[{b64_json:'/9j/'}]}).extension,'jpg');
});
