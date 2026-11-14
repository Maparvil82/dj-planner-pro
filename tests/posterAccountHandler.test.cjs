const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
const root='supabase/functions/poster-ai/';
function moduleOf(file,deps={}){const m={exports:{}};new Function('module','exports','require',ts.transpileModule(fs.readFileSync(root+file+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(m,m.exports,name=>deps[name]);return m.exports;}
const domain=moduleOf('domain'),gallery=moduleOf('gallery',{'./domain.ts':domain}),store=moduleOf('store'),commerce=moduleOf('commerce',{'./domain.ts':domain,'./store.ts':store}),provider=moduleOf('provider',{'./domain.ts':domain});
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',session='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function fixture({mime='image/jpeg',original=Buffer.from([255,216,255]),conversionError=false,welcome=false,pro=false,revenuecatFailure=false,grantError=null,creditMode='production',serverPro=false,providerFailure=false,providerGate=null,loseSettlement=false}={}){
 const copies=[];const payloads=[];const grants=[];let planPro=pro;let planReads=0;
 const sessionCopy=Uint8Array.from([255,216,255,1]);
 const jobs=[];const recovered=[];const uploads=[];const pending=[];let handler;let inferenceCalls=0;
 const status={creditMode,proActive:serverPro,promotionAvailable:welcome,promotionClaimedCredits:0,credits:welcome?0:5,testCredits:welcome?0:5,enabled:true,canGenerate:true,purchasesEnabled:false,remainingOperations:2,available_eur_cents:214};
 class Query{
  filters=[];change=null;singleRow=false;orders=[];max=Infinity;cursor=null;notNull=[];
  select(){return this;}eq(key,value){this.filters.push([key,value]);return this;}order(key){this.orders.push(key);return this;}limit(max){this.max=max;return this;}
  not(key,operator,value){assert.equal(operator,'is');assert.equal(value,null);this.notNull.push(key);return this;}
  or(expression){const match=expression.match(/^created_at\.lt\.([^,]+),and\(created_at\.eq\.([^,]+),id\.lt\.([a-f0-9-]+)\)$/i);assert.ok(match);assert.equal(match[1],match[2]);this.cursor={createdAt:match[1],id:match[3]};return this;}
  update(change){this.change=change;return this;}single(){this.singleRow=true;return this;}
  then(resolve,reject){try{const data=jobs.filter(row=>this.filters.every(([key,value])=>row[key]===value)&&this.notNull.every(key=>row[key]!=null)&&(!this.cursor||Date.parse(row.created_at)<Date.parse(this.cursor.createdAt)||(Date.parse(row.created_at)===Date.parse(this.cursor.createdAt)&&row.id<this.cursor.id))).sort((a,b)=>{for(const key of this.orders){const comparison=String(b[key]).localeCompare(String(a[key]));if(comparison)return comparison;}return 0;}).slice(0,this.max);if(this.change)data.forEach(row=>Object.assign(row,this.change));return Promise.resolve(this.singleRow?{data:data[0]??null,error:data.length?null:{message:'not found'}}:{data,error:null}).then(resolve,reject);}catch(e){return Promise.reject(e).then(resolve,reject);}}
 }
 const admin={auth:{getUser:async token=>({data:{user:token==='a'||token==='b'?{id:token==='a'?a:b,email:'fixture@example.invalid',email_confirmed_at:'confirmed'}:null},error:null})},
  from:table=>{assert.equal(table,'poster_ai_jobs');return new Query();},
  rpc:async(name,args)=>{
   if(name==='poster_recover_job'){recovered.push(args);return {data:null,error:null};}
   if(name==='poster_begin_provider'){const job=jobs.find(j=>j.id===args.p_id&&j.user_id===args.p_user&&j.status==='running'&&!j.provider_started_at);if(job)job.provider_started_at=new Date().toISOString();return {data:Boolean(job),error:null};}
   if(name==='poster_account_status')return {data:{...status},error:null};
   if(name==='poster_claim_promotion'){grants.push(args);assert.equal(args.p_user,b);if(grantError)return {error:grantError};const target=args.p_pro?5:3;status.credits+=Math.max(0,target-status.promotionClaimedCredits);status.promotionClaimedCredits=Math.max(status.promotionClaimedCredits,target);if(args.p_pro)status.promotionAvailable=false;return {error:null};}
   if(name==='reserve_session_poster_job'){
    assert.equal(args.p_user,b);const existing=jobs.find(j=>j.id===args.p_id);if(existing)return {data:{created:false,job:existing},error:null};const job={id:args.p_id,user_id:args.p_user,session_id:args.p_session,parent_id:args.p_parent,form:args.p_form,status:'running',credit_mode:'production'};jobs.push(job);return {data:{created:true,job},error:null};
   }
   if(name==='settle_poster_ai_job'){if(loseSettlement)return {error:{message:'unavailable'}};const job=jobs.find(j=>j.id===args.p_id);if(!['running','uncertain'].includes(job.status))return {error:null};Object.assign(job,{status:args.p_status,output_path:args.p_output,error_code:args.p_error});return {error:null};}
   throw Error('Unexpected RPC '+name);
  },storage:{from:bucket=>{assert.ok(['poster-ai-private','sessions'].includes(bucket));return {
   upload:async(path,bytes,options)=>{
    if(bucket==='sessions'){assert.equal(options.contentType,'image/jpeg');assert.ok(bytes.length<=1048576);assert.equal(bytes[0],255);assert.ok(path.endsWith('.jpg'));}
    else {assert.equal(options.contentType,mime);assert.deepEqual(Buffer.from(bytes),original);}
    uploads.push({bucket,path});payloads.push({bucket,bytes:Buffer.from(bytes)});return {error:null};},
   getPublicUrl:path=>({data:{publicUrl:'https://example.test/storage/v1/object/public/sessions/'+path}}),
   createSignedUrls:async paths=>({data:paths.map(path=>({path,signedUrl:'https://signed.example/'+path})),error:null}),
   createSignedUrl:async path=>({data:{signedUrl:'https://signed.example/'+path},error:null}),
  };}}
 };
 const deps={'./gallery.ts':gallery,'./session-image.ts':{sessionPosterImage:async(bytes,type)=>{copies.push({bytes:Buffer.from(bytes),mime:type});if(conversionError)throw new domain.PosterError('poster_invalid_output');return sessionCopy;}},'npm:@supabase/supabase-js@2.99.1':{createClient:()=>admin},'./domain.ts':domain,'./store.ts':store,'./commerce.ts':commerce,
  './provider.ts':{...provider,providerConfig:()=>({provider:'vertex'}),providerRequest:async()=>({url:'https://inference.example',headers:{},body:'{}'})}};
 const source=fs.readFileSync(root+'index.ts','utf8');
 for(const match of source.matchAll(/import \{(\w+)\} from '(\.\/(?:[\w-]+reference|reference)\.ts)'/g))deps[match[2]]={[match[1]]:'data:image/jpeg;base64,/9j/'};
 const mockFetch=async url=>{if(url===`https://api.revenuecat.com/v1/subscribers/${b}`){planReads++;if(revenuecatFailure)return new Response('',{status:503});return Response.json(planPro?{subscriber:{entitlements:{'DJ Planner Pro':{product_identifier:'annual',expires_date:'2099-01-01'}},subscriptions:{annual:{is_sandbox:false,period_type:'normal'}}}}:{subscriber:{entitlements:{},subscriptions:{}}});}assert.equal(url,'https://inference.example');inferenceCalls++;if(providerGate)await providerGate;if(providerFailure)throw new Error('connection lost');return Response.json({usageMetadata:{promptTokenCount:10,totalTokenCount:1130,candidatesTokenCount:1120},candidates:[{content:{parts:[{inlineData:{mimeType:mime,data:original.toString('base64')}}]}}]});};
 new Function('Deno','require','fetch','EdgeRuntime','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)({env:{get:name=>name==='POSTER_PROMOTION_SALT'?'fixture-salt-'.repeat(4):''},serve:h=>{handler=h;}},name=>{assert.ok(name in deps,name);return deps[name];},mockFetch,{waitUntil:p=>pending.push(p)},{});
 const request=(body,token='b')=>handler(new Request('https://example.test/poster-ai',{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify(body)}));
 return {request,jobs,recovered,uploads,payloads,copies,pending,grants,planReads:()=>planReads,setPro:value=>{planPro=value;},spend:amount=>{status.credits-=amount;},inferences:()=>inferenceCalls};
}
test('authenticated generation uses the caller throughout reservation, image storage and retrieval, ignoring a forged body owner',async()=>{
 const f=fixture();const response=await f.request({action:'generate',id,sessionId:session,userId:a,creditMode:'simulation',form:{title:'Session',djs:['Artist'],date:'2099-12-24',time:'23:30',venue:'Venue',style:'Headliner',format:'Cartel'},photos:[]});
 assert.equal(response.status,202);await Promise.all(f.pending);assert.equal(f.inferences(),1);assert.equal(f.jobs[0].status,'complete');assert.deepEqual(f.uploads,[{bucket:'poster-ai-private',path:`${b}/${id}.jpg`},{bucket:'sessions',path:`${b}/poster_ai_${id}.jpg`}]);assert.match(f.jobs[0].session_poster_url,/\/sessions\//);
 const own=await f.request({action:'get',id},'b');assert.equal(own.status,200);assert.match((await own.json()).job.imageUrl,new RegExp(b));
 const foreign=await f.request({action:'get',id},'a');assert.equal(foreign.status,404);
 const list=await f.request({action:'list'},'a');assert.deepEqual((await list.json()).jobs,[]);
});
test('production accounts cannot invoke test purchases, and unauthenticated requests never reach inference',async()=>{
 const f=fixture();assert.equal((await f.request({action:'test_purchase',id,package:'studio'})).status,403);
 assert.equal((await f.request({action:'status'},'bad')).status,401);assert.equal(f.inferences(),0);
});

const generateBody={action:'generate',id,sessionId:session,form:{title:'Session',djs:['Artist'],date:'2099-12-24',time:'23:30',venue:'Venue',style:'Headliner',format:'Cartel'},photos:[]};
test('PNG original stays private and unchanged while the session receives only its JPEG copy',async()=>{
 const original=Buffer.from([137,80,78,71,13,10,26,10]);const f=fixture({mime:'image/png',original});
 assert.equal((await f.request(generateBody)).status,202);await Promise.all(f.pending);
 assert.equal(f.jobs[0].status,'complete');assert.equal(f.inferences(),1);
 assert.deepEqual(f.uploads,[{bucket:'poster-ai-private',path:`${b}/${id}.png`},{bucket:'sessions',path:`${b}/poster_ai_${id}.jpg`}]);
 assert.deepEqual(f.payloads[0].bytes,original);assert.deepEqual(f.copies,[{bytes:original,mime:'image/png'}]);
 const response=await f.request({action:'get',id});assert.equal((await response.json()).job.imageMime,'image/png');
});
test('JPEG over the session limit is converted before upload without changing the stored original',async()=>{
 const original=Buffer.alloc(1048576+2000);original.set([255,216,255]);const f=fixture({original});
 await f.request(generateBody);await Promise.all(f.pending);
 assert.equal(f.jobs[0].status,'complete');assert.equal(f.copies[0].bytes.length,original.length);
 assert.deepEqual(f.payloads[0].bytes,original);assert.ok(f.payloads[1].bytes.length<1048576);assert.equal(f.inferences(),1);
});
test('conversion failure preserves the private original and never attaches incompatible data or retries inference',async()=>{
 const f=fixture({conversionError:true});await f.request(generateBody);await Promise.all(f.pending);
 assert.deepEqual(f.uploads,[{bucket:'poster-ai-private',path:`${b}/${id}.jpg`}]);
 assert.equal(f.jobs[0].session_poster_url,undefined);assert.equal(f.jobs[0].status,'uncertain');assert.equal(f.inferences(),1);
});


test('opening the gallery assigns Free welcome credits before returning the visible balance',async()=>{
 const f=fixture({welcome:true});const response=await f.request({action:'list',p_pro:true,userId:a});assert.equal(response.status,200);
 assert.equal((await response.json()).budget.credits,3);assert.equal(f.grants.length,1);assert.equal(f.grants[0].p_pro,false);assert.match(f.grants[0].p_identity_hash,/^[a-f0-9]{64}$/);assert.equal(f.inferences(),0);
 f.spend(1);const repeat=await f.request({action:'status'});assert.equal((await repeat.json()).budget.credits,2);assert.equal(f.grants.length,1);
});
test('verified Pro receives 5 automatically; a later upgrade adds exactly 2 without refilling spent credits',async()=>{
 const direct=fixture({welcome:true,pro:true});assert.equal((await (await direct.request({action:'list'})).json()).budget.credits,5);
 assert.equal((await (await direct.request({action:'status'})).json()).budget.credits,5);assert.equal(direct.grants.length,1);assert.equal(direct.planReads(),1);
 const f=fixture({welcome:true});await f.request({action:'list'});f.spend(1);f.setPro(true);
 assert.equal((await (await f.request({action:'list'})).json()).budget.credits,4);assert.deepEqual(f.grants.map(g=>g.p_pro),[false,true]);
 await f.request({action:'claim_promotion'});assert.equal(f.grants.length,2);assert.equal(f.inferences(),0);
});
test('plan verification and unexpected database failures do not return a successful provisional zero',async()=>{
 for(const options of [{revenuecatFailure:true},{grantError:{message:'UPDATE requires a WHERE clause',code:'21000'}}]){
  const f=fixture({welcome:true,...options});const response=await f.request({action:'list'});assert.equal(response.status,503);assert.equal((await response.json()).error,'poster_credit_sync_unavailable');assert.equal(f.inferences(),0);
 }
});
test('closed or already-used campaigns and simulation accounts keep their existing balance without automatic grants',async()=>{
 const closed=fixture();assert.equal((await (await closed.request({action:'list'})).json()).budget.credits,5);assert.equal(closed.planReads(),0);
 const simulation=fixture({creditMode:'simulation',welcome:true});assert.equal((await simulation.request({action:'status'})).status,200);assert.equal(simulation.grants.length,0);assert.equal(simulation.planReads(),0);
 for(const message of ['poster_promotion_unavailable','poster_promotion_claimed']){
  const f=fixture({welcome:true,grantError:{message}});assert.equal((await f.request({action:'status'})).status,200);assert.equal(f.inferences(),0);
 }
 const anon=fixture({welcome:true});assert.equal((await anon.request({action:'list'},'bad')).status,401);assert.equal(anon.grants.length,0);assert.equal(anon.planReads(),0);
});


test('server-verified Pro trials receive 5 automatically even if the store is unavailable',async()=>{
 const f=fixture({welcome:true,serverPro:true,revenuecatFailure:true});
 const response=await f.request({action:'list'});assert.equal(response.status,200);assert.equal((await response.json()).budget.credits,5);assert.equal(f.planReads(),0);assert.equal(f.grants[0].p_pro,true);
 await f.request({action:'list'});assert.equal(f.grants.length,1);assert.equal(f.inferences(),0);
});
test('a client-provided Pro flag cannot change the server-verified Free gift',async()=>{
 const f=fixture({welcome:true});const response=await f.request({action:'status',proActive:true,isPro:true,p_pro:true});assert.equal((await response.json()).budget.credits,3);assert.equal(f.grants[0].p_pro,false);
});

function seedGallery(f,count=75){
 for(let n=1;n<=count;n++){const jobId=`cccccccc-cccc-4ccc-8ccc-${String(n).padStart(12,'0')}`;f.jobs.push({id:jobId,user_id:n%2?a:b,status:'complete',created_at:'2026-10-27T23:00:00.123456+00:00',output_path:`${n%2?a:b}/${jobId}.jpg`,form:{title:`Poster ${n}`,djs:['Artist'],venue:'Venue',date:'2099-12-24',time:'23:30',style:'Headliner',format:'Cartel'},is_published:false,instruction:'private edit prompt',usage:{secret:'private'},provider_request_id:'private-provider-id',session_id:session});}
}
test('Explore contains completed artwork from all accounts without manual publication or private job fields',async()=>{
 const f=fixture();seedGallery(f,3);f.jobs.push({...f.jobs[0],id:'failed',status:'failed'},{...f.jobs[0],id:'running',status:'running'},{...f.jobs[0],id:'no-image',output_path:null});
 const response=await f.request({action:'explore'});assert.equal(response.status,200);const feed=await response.json();
 assert.equal(feed.jobs.length,3);assert.deepEqual(feed.jobs.map(j=>j.form.title),['Poster 3','Poster 2','Poster 1']);assert.equal(feed.nextCursor,null);
 for(const item of feed.jobs){assert.deepEqual(Object.keys(item).sort(),['form','id','imageUrl']);assert.match(item.imageUrl,/signed\.example/);}
 assert.equal((await f.request({action:'explore'},'bad')).status,401);assert.equal(f.inferences(),0);
});
test('gallery cursor reaches every poster exactly once, including identical timestamps and new insertions',async()=>{
 const f=fixture();seedGallery(f);const first=await (await f.request({action:'explore'})).json();assert.equal(first.jobs.length,30);assert.ok(first.nextCursor);
 f.jobs.push({...f.jobs[0],id:'dddddddd-dddd-4ddd-8ddd-000000000001',created_at:'2026-10-28T00:00:00Z'});
 const second=await (await f.request({action:'explore',cursor:first.nextCursor})).json();const third=await (await f.request({action:'explore',cursor:second.nextCursor})).json();
 assert.equal(second.jobs.length,30);assert.equal(third.jobs.length,15);assert.equal(third.nextCursor,null);assert.equal(new Set([...first.jobs,...second.jobs,...third.jobs].map(j=>j.id)).size,75);
});
test('My posters stays caller-owned on every page and forged owners cannot retrieve or publish others',async()=>{
 const f=fixture();seedGallery(f);let cursor=null;const own=[];
 do{const response=await f.request({action:'list',userId:a,cursor});assert.equal(response.status,200);const page=await response.json();own.push(...page.jobs);cursor=page.nextCursor;}while(cursor);
 assert.equal(own.length,37);for(const job of own)assert.match(job.imageUrl,new RegExp(b));
 const foreign=f.jobs.find(j=>j.user_id===a);assert.equal((await f.request({action:'get',id:foreign.id,userId:a})).status,404);assert.equal((await f.request({action:'publish',id:foreign.id,published:true,userId:a})).status,404);assert.equal(foreign.is_published,false);
});
test('malformed pagination cannot inject query filters or bypass ownership',async()=>{
 const f=fixture();seedGallery(f,1);
 for(const cursor of [{createdAt:'2026-10-27T00:00:00Z,or(user_id.eq.other)',id}, {createdAt:'2026-10-27T00:00:00Z',id:'bad'},'all',{}])for(const action of ['explore','list'])assert.equal((await f.request({action,cursor})).status,400);
 assert.equal(f.inferences(),0);
});

test('a lost generation response and repeat of the same request never dispatch a second provider call',async()=>{
 let release;const gate=new Promise(resolve=>{release=resolve;});const f=fixture({providerGate:gate});
 await f.request(generateBody); // Pretend the caller lost this response, then reconnects.
 assert.equal(f.jobs.length,1);const repeated=await f.request(generateBody);assert.equal(repeated.status,202);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(f.inferences(),1);
 const running=await f.request({action:'list'});assert.equal((await running.json()).jobs[0].status,'running');
 release();await Promise.all(f.pending);assert.equal(f.jobs[0].status,'complete');assert.equal(f.inferences(),1);
 const after=await f.request({action:'get',id});assert.equal((await after.json()).job.status,'complete');assert.ok(f.recovered.every(args=>args.p_user===b));
});
test('a provider disconnect leaves an uncertain result for recovery without another paid request',async()=>{
 const f=fixture({providerFailure:true});await f.request(generateBody);await Promise.all(f.pending);
 assert.equal(f.jobs[0].status,'uncertain');assert.equal(f.inferences(),1);
 await f.request({action:'get',id});await f.request({action:'list'});await f.request({action:'status'});
 assert.equal(f.inferences(),1);assert.ok(f.recovered.length>=4);assert.equal(f.uploads.length,0);
});
test('lost completion writes preserve the saved image and never retry inference',async()=>{
 const f=fixture({loseSettlement:true});await f.request(generateBody);await Promise.all(f.pending);
 assert.equal(f.jobs[0].status,'running');assert.equal(f.uploads.length,2);assert.equal(f.inferences(),1);
 await f.request({action:'get',id});assert.equal(f.inferences(),1);assert.equal(f.recovered.at(-1).p_user,b);
});
