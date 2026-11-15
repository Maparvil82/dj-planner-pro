import {sessionPosterImage} from './session-image.ts';
import {galleryCursor,galleryQuery,galleryPage} from './gallery.ts';
import {sandboxReceipts} from './store.ts';
import {storeConfig,storeReady,readPurchases,promotionIdentity,verifiedPro,type VerifiedPurchase} from './commerce.ts';
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };
import {createClient} from 'npm:@supabase/supabase-js@2.99.1';
import {OWNER,PosterError,validateInput,hashInput,type JobInput} from './domain.ts';
import {providerConfig,providerRequest,providerUsage,providerOutput,type ProviderConfig} from './provider.ts';
import {pulsoReference} from './pulso-reference.ts';
import {referenceImage} from './reference.ts';
import {headlinerReference} from './headliner-reference.ts';
import {raveReference} from './rave-reference.ts';
import {discoReference} from './disco-reference.ts';
import {verdeIndieReference} from './verde-indie-reference.ts';
import {cabinaAnalogicaReference} from './cabina-analogica-reference.ts';
import {collageSerenoReference} from './collage-sereno-reference.ts';
import {viniloReference} from './vinilo-reference.ts';
import {offsetRadicalReference} from './offset-radical-reference.ts';
import {coralManifestoReference} from './coral-manifesto-reference.ts';
import {impactoAmarilloReference} from './impacto-amarillo-reference.ts';
import {duotonoReference} from './duotono-reference.ts';
import {rememberReference} from './remember-reference.ts';
import {summerClubReference} from './summer-club-reference.ts';
import {urbanChromeReference} from './urban-chrome-reference.ts';
import {premiumNightReference} from './premium-night-reference.ts';
import {popClubReference} from './pop-club-reference.ts';
import {bauhausReference} from './bauhaus-reference.ts';
import {jardinReference} from './jardin-reference.ts';
import {jazzReference} from './jazz-reference.ts';
const url=Deno.env.get('SUPABASE_URL')!;
const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const bucket='poster-ai-private';
const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
const dbCheck=(error:{message:string}|null)=>{if(error)throw new PosterError('poster_server_error',503);};
async function budget(userId:string){
  const {data,error}=await admin.rpc('poster_account_status',{p_user:userId});
  if(error){if(error.message.includes('poster_forbidden'))throw new PosterError('poster_forbidden',403);dbCheck(error);}
  let configured=false;try{providerConfig(name=>Deno.env.get(name));configured=true;}catch{/* Missing or expired configuration disables new generations. */}
  return {...data,purchasesEnabled:data.purchasesEnabled&&storeReady(name=>Deno.env.get(name))&&configured&&data.enabled&&data.available_eur_cents>=75,canGenerate:data.canGenerate&&configured,configured};
}
async function ensureWelcomeCredits(userId:string,email:string|undefined,account:Record<string,any>){
 if(account.creditMode!=='production'||!account.promotionAvailable||!email)return account;
 const identity=await promotionIdentity(email,Deno.env.get('POSTER_PROMOTION_SALT')??'');
 let pro=account.proActive===true;
 if(!pro)try{
  const rc=await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,{headers:{Authorization:`Bearer ${Deno.env.get('REVENUECAT_API_KEY')||'appl_txIQHoyExsJQrrCekQjlfhNEOMs'}`},signal:AbortSignal.timeout(10000)});
  if(!rc.ok)throw new Error('revenuecat_unavailable');
  pro=verifiedPro(await rc.json());
 }catch{
  console.error('poster-ai welcome credits unavailable',{stage:'verify_plan'});
  throw new PosterError('poster_credit_sync_unavailable',503);
 }
 // A Free account already received its gift; recheck the plan so a later Pro upgrade adds only the difference.
 if(!pro&&(account.promotionClaimedCredits??0)>=3)return account;
 const {error}=await admin.rpc('poster_claim_promotion',{p_user:userId,p_identity_hash:identity,p_pro:pro});
 if(error){
  if(error.message.includes('poster_promotion_unavailable')||error.message.includes('poster_promotion_claimed'))return budget(userId);
  console.error('poster-ai welcome credits unavailable',{stage:'grant',code:error.code??'unknown'});
  throw new PosterError('poster_credit_sync_unavailable',503);
 }
 return budget(userId);
}
async function applyPurchase(p:VerifiedPurchase){
 const {error}=await admin.rpc('poster_apply_purchase',{p_user:p.userId,p_transaction:p.transaction,p_product:p.product,p_quantity:p.quantity,p_refunded:p.refunded,p_observed_ms:p.observedMs});
 if(error?.message.includes('poster_store_identity'))throw new PosterError('poster_store_identity',409);dbCheck(error);
}
async function settle(id:string,status:string,errorCode:string|null=null,output:string|null=null,requestId:string|null=null,noCharge=false){
 const {error}=await admin.rpc('settle_poster_ai_job',{p_id:id,p_status:status,p_usage:null,p_output:output,p_error:errorCode,p_request:requestId,p_no_charge:noCharge});dbCheck(error);
}
async function present(job:Record<string,any>){
  let imageUrl=null;
  if(job.status==='complete'&&job.output_path){const {data,error}=await admin.storage.from(bucket).createSignedUrl(job.output_path,3600);dbCheck(error);imageUrl=data?.signedUrl;}
  return {id:job.id,status:job.status,sessionId:job.session_id,parentId:job.parent_id,form:job.form,instruction:job.instruction,imageUrl,imageMime:job.output_path?.endsWith('.png')?'image/png':'image/jpeg',errorCode:job.error_code,createdAt:job.created_at,usage:job.usage,isPublished:job.is_published===true,sessionPosterApplied:job.session_poster_applied===true};
}
async function run(input:JobInput,config:ProviderConfig,userId:string){
  let sent=false;
  try{
    const images=[{image_url:input.form.style==='Pulso'?pulsoReference:input.form.style==='Verde Indie'?verdeIndieReference:input.form.style==='Cabina Analógica'?cabinaAnalogicaReference:input.form.style==='Collage Sereno'?collageSerenoReference:input.form.style==='Vinilo a Mano'?viniloReference:input.form.style==='Offset Radical'?offsetRadicalReference:input.form.style==='Coral Manifesto'?coralManifestoReference:input.form.style==='Impacto Amarillo'?impactoAmarilloReference:input.form.style==='Duotono Editorial'?duotonoReference:input.form.style==='Remember'?rememberReference:input.form.style==='Summer Club'?summerClubReference:input.form.style==='Urban Chrome'?urbanChromeReference:input.form.style==='Premium Night'?premiumNightReference:input.form.style==='Pop Club'?popClubReference:input.form.style==='Bauhaus Sonoro'?bauhausReference:input.form.style==='Jardín Surreal'?jardinReference:input.form.style==='Jazz de Autor'?jazzReference:input.form.style==='Disco Collage'?discoReference:input.form.style==='Rave Industrial'?raveReference:input.form.style==='Headliner'?headlinerReference:referenceImage}];
    if(input.parentId){
      const {data:parent,error}=await admin.from('poster_ai_jobs').select('output_path').eq('id',input.parentId).eq('user_id',userId).eq('session_id',input.sessionId).eq('status','complete').single();dbCheck(error);
      if(!parent?.output_path)throw new PosterError('poster_parent_unavailable');
      const {data:blob,error:downloadError}=await admin.storage.from(bucket).download(parent.output_path);dbCheck(downloadError);
      const bytes=new Uint8Array(await blob!.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
      images.push({image_url:`data:${blob!.type};base64,${btoa(binary)}`});
    }
    images.push(...input.photos.map(p=>({image_url:p.dataUrl})));
    const request=await providerRequest(config,input,images);
    const {data:started,error:startError}=await admin.rpc('poster_begin_provider',{p_id:input.id,p_user:userId});dbCheck(startError);
    if(!started)return;
    sent=true;
    // One provider call only. Neither SDK retries nor automatic failover are used.
    const response=await fetch(request.url,{method:'POST',headers:request.headers,body:request.body,signal:AbortSignal.timeout(120000)});
    const requestId=response.headers.get('x-request-id')??response.headers.get('x-goog-request-id');
    if(!response.ok){
      const status=response.status;
      const errorCode=status===401||status===403?'poster_provider_key':status===429?'poster_provider_quota':status>=500||status===408?'poster_provider_uncertain':'poster_provider_rejected';
      const uncertain=status>=500||status===408;
      // Keep useful diagnostics without logging prompts, portraits, credentials or provider bodies.
      console.error('poster-ai provider rejected',{id:input.id,provider:config.provider,httpStatus:status,code:errorCode});
      await settle(input.id,uncertain?'uncertain':'failed',errorCode,null,requestId,!uncertain);return;
    }
    const result=await response.json();
    // Persist metering before handling or uploading output, even on a later failure.
    const {error:usageError}=await admin.from('poster_ai_jobs').update({usage:providerUsage(config,result),provider_request_id:requestId??result.responseId??null}).eq('id',input.id).eq('status','running');dbCheck(usageError);
    const output=providerOutput(config,result);
    const outputPath=`${userId}/${input.id}.${output.extension}`;
    const {error:uploadError}=await admin.storage.from(bucket).upload(outputPath,output.bytes,{contentType:output.mime,upsert:false});dbCheck(uploadError);
    // Store a durable session asset; never save an expiring signed URL.
    const sessionImage=await sessionPosterImage(output.bytes,output.mime);
    const sessionPath=`${userId}/poster_ai_${input.id}.jpg`;
    const {error:sessionUploadError}=await admin.storage.from('sessions').upload(sessionPath,sessionImage,{contentType:'image/jpeg',upsert:false});dbCheck(sessionUploadError);
    const {data:sessionAsset}=admin.storage.from('sessions').getPublicUrl(sessionPath);
    const {error:attachmentError}=await admin.from('poster_ai_jobs').update({session_poster_url:sessionAsset.publicUrl}).eq('id',input.id).eq('user_id',userId).eq('status','running');dbCheck(attachmentError);
    await settle(input.id,'complete',null,outputPath);
  }catch(error){
    // Retain budget on unknown outcomes; require reconciliation before another call.
    const code=error instanceof PosterError?error.code:'poster_provider_uncertain';
    try { await settle(input.id,sent?'uncertain':'failed',sent?code:'poster_not_sent',null,null,!sent); } catch { /* Automatic recovery checks durable output; never retry generation. */ }
    console.error('poster-ai job failed',{id:input.id,code});
  }
}
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{headers});
  if(req.method!=='POST')return json({error:'poster_method'},405);
  try{
    const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');
    if(!token)throw new PosterError('poster_unauthorized',401);
    const {data,error}=await admin.auth.getUser(token);
    if(error||!data.user)throw new PosterError('poster_unauthorized',401);
    if(!data.user.email_confirmed_at)throw new PosterError('poster_forbidden',403);
    const userId=data.user.id;
    // Cap streamed body size as well as Content-Length, which a client may omit.
    const reader=req.body?.getReader();if(!reader)throw new PosterError('poster_invalid_input');
    let length=0;const chunks:Uint8Array[]=[];
    while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>2750000){await reader.cancel();throw new PosterError('poster_body_too_large',413);}chunks.push(value);}
    const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    let raw;try{raw=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new PosterError('poster_invalid_input');}
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new PosterError('poster_invalid_input');
    if(['list','get','status','generate'].includes(raw.action)){
      const {error:recoveryError}=await admin.rpc('poster_recover_job',{p_user:userId,p_base_url:url});dbCheck(recoveryError);
    }
    let account=await budget(userId);
    if(['list','status','claim_promotion'].includes(raw.action))account=await ensureWelcomeCredits(userId,data.user.email,account);
    if(raw.action==='explore'){
      const cursor=galleryCursor(raw.cursor);
      const {data:rows,error}=await galleryQuery(admin.from('poster_ai_jobs').select('id,form,output_path,created_at').eq('status','complete').not('output_path','is',null),cursor);dbCheck(error);
      const page=galleryPage(rows??[]);
      if(!page.jobs.length)return json({jobs:[],nextCursor:null});
      const {data:images,error:imageError}=await admin.storage.from(bucket).createSignedUrls(page.jobs.map(job=>job.output_path),3600);dbCheck(imageError);
      const feed=page.jobs.map((job,index)=>({id:job.id,form:job.form,imageUrl:images?.[index]?.signedUrl??null})).filter(job=>job.imageUrl);
      return json({jobs:feed,nextCursor:page.nextCursor});
    }
    if(raw.action==='publish'){
      if(typeof raw.id!=='string'||!/^[a-f0-9-]{36}$/i.test(raw.id)||typeof raw.published!=='boolean')throw new PosterError('poster_invalid_input');
      const {data:job,error}=await admin.from('poster_ai_jobs').update({is_published:raw.published}).eq('id',raw.id).eq('user_id',data.user.id).eq('status','complete').select('*').single();
      if(error||!job)throw new PosterError('poster_not_found',404);
      return json({job:await present(job),budget:await budget(userId)});
    }
    if(raw.action==='sync_store'){
      if(account.creditMode==='production'){
        const purchases=await readPurchases(storeConfig(name=>Deno.env.get(name)),userId);
        for(const purchase of purchases)await applyPurchase(purchase);
        return json({budget:await budget(userId),verifiedPurchases:purchases.filter(p=>!p.refunded).length});
      }
      const key=Deno.env.get('REVENUECAT_API_KEY')||'appl_txIQHoyExsJQrrCekQjlfhNEOMs';
      const rc=await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(data.user.id)}`,{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(10000)});
      if(!rc.ok)throw new PosterError('poster_store_unavailable',503);
      let receipts;try{receipts=sandboxReceipts(await rc.json());}catch{throw new PosterError('poster_store_unavailable',503);}
      for(const receipt of receipts){const {error}=await admin.rpc('poster_grant_sandbox_receipt',{p_user:data.user.id,p_receipt:receipt.receipt,p_product:receipt.product});dbCheck(error);}
      return json({budget:await budget(userId),verifiedSandboxPurchases:receipts.length});
    }
    // Compatibility for clients that still show the former claim button.
    if(raw.action==='claim_promotion')return json({budget:account});
    if(raw.action==='test_purchase'){
      if(account.creditMode!=='simulation'||userId!==OWNER)throw new PosterError('poster_forbidden',403);
      if(typeof raw.id!=='string'||!/^[a-f0-9-]{36}$/i.test(raw.id)||!['starter','studio'].includes(raw.package))throw new PosterError('poster_invalid_input');
      const {error}=await admin.rpc('poster_test_purchase',{p_user:OWNER,p_id:raw.id,p_package:raw.package});dbCheck(error);
      return json({budget:await budget(userId)});
    }
    if(raw.action==='status')return json({budget:account});
    if(raw.action==='list'){
      const cursor=galleryCursor(raw.cursor);
      const {data:rows,error}=await galleryQuery(admin.from('poster_ai_jobs').select('*').eq('user_id',userId),cursor);dbCheck(error);
      const page=galleryPage(rows??[]);
      return json({jobs:await Promise.all(page.jobs.map(present)),nextCursor:page.nextCursor,budget:account});
    }
    if(raw.action==='get'){
      if(typeof raw.id!=='string'||!/^[a-f0-9-]{36}$/i.test(raw.id))throw new PosterError('poster_invalid_input');
      const {data:job,error}=await admin.from('poster_ai_jobs').select('*').eq('id',raw.id).eq('user_id',userId).single();
      if(error||!job)throw new PosterError('poster_not_found',404);
      return json({job:await present(job),budget:await budget(userId)});
    }
    if(raw.action!=='generate')throw new PosterError('poster_invalid_input');
    const input=validateInput(raw);
    const config=providerConfig(name=>Deno.env.get(name));
    const {data:reserved,error:reserveError}=await admin.rpc('reserve_session_poster_job',{p_id:input.id,p_user:userId,p_session:input.sessionId,p_parent:input.parentId,p_hash:await hashInput(input),p_form:input.form,p_instruction:input.instruction,p_expected_poster:input.expectedPosterUrl??null});
    if(reserveError){const known=['poster_session_poster_changed','poster_credits_empty','poster_id_conflict','poster_disabled','poster_busy','poster_budget_exhausted','poster_session_unavailable','poster_parent_unavailable'];throw new PosterError(known.find(code=>reserveError.message.includes(code))??'poster_server_error',409);}
    if(reserved.created)EdgeRuntime.waitUntil(run(input,config,userId));
    return json({job:await present(reserved.job),budget:await budget(userId)},202);
  }catch(e){const err=e instanceof PosterError?e:new PosterError('poster_server_error',500);return json({error:err.code},err.status);}
});
