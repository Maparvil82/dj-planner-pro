import {PosterError} from '../poster-ai/domain.ts';
import {storeConfig,readTransaction,webhookTransaction,secretEquals,type VerifiedPurchase} from '../poster-ai/commerce.ts';
export function webhookHandler(env:(name:string)=>string|undefined,apply:(purchase:VerifiedPurchase)=>Promise<void>,send:typeof fetch=fetch){
 return async(req:Request)=>{
  const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
  if(req.method!=='POST')return reply({error:'poster_method'},405);
  const secret=env('POSTER_REVENUECAT_WEBHOOK_TOKEN')??'';
  if(secret.length<32)return reply({error:'poster_store_unavailable'},503);
  if(!await secretEquals(req.headers.get('Authorization')??'',`Bearer ${secret}`))return reply({error:'poster_unauthorized'},401);
  try{
   const reader=req.body?.getReader();if(!reader)throw new PosterError('poster_invalid_input');
   const decoder=new TextDecoder();let raw='',size=0;
   while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();throw new PosterError('poster_body_too_large',413);}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();
   let body:unknown;try{body=JSON.parse(raw);}catch{throw new PosterError('poster_invalid_input');}
   const config=storeConfig(env);const transaction=webhookTransaction(body,config.app);
   if(!transaction)return reply({received:true});
   // Re-read the authoritative current state: duplicate and out-of-order events cannot re-award a refund.
   const purchases=await readTransaction(config,transaction,send);
   const matches=purchases.filter(p=>p.transaction===transaction);
   if(matches.length!==1)throw new PosterError('poster_store_unavailable',503);
   await apply(matches[0]);
   // Acknowledge only after durable settlement; RevenueCat retries failed delivery.
   return reply({received:true});
  }catch(e){const error=e instanceof PosterError?e:new PosterError('poster_store_unavailable',503);return reply({error:error.code},error.status);}
 };
}
