import {PosterError} from './domain.ts';
import {POSTER_PRODUCTS} from './store.ts';

export type StoreConfig={key:string;project:string;app:string};
export type VerifiedPurchase={userId:string;transaction:string;product:string;quantity:number;refunded:boolean;observedMs:number};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export function storeConfig(env:(name:string)=>string|undefined):StoreConfig{
 const key=env('POSTER_REVENUECAT_SECRET_KEY')??'',project=env('POSTER_REVENUECAT_PROJECT_ID')??'',app=env('POSTER_REVENUECAT_APP_ID')??'';
 if(!key.startsWith('sk_')||! /^[a-zA-Z0-9_-]{6,64}$/.test(project)||!/^app[a-zA-Z0-9]+$/.test(app))throw new PosterError('poster_store_unavailable',503);
 return {key,project,app};
}
export function storeReady(env:(name:string)=>string|undefined){
 try{return !!storeConfig(env)&&env('POSTER_STORE_WEBHOOK_READY')==='true'&&(env('POSTER_REVENUECAT_WEBHOOK_TOKEN')?.length??0)>=32;}
 catch{return false;}
}
async function read(config:StoreConfig,path:string,send:typeof fetch){
 const response=await send('https://api.revenuecat.com'+path,{headers:{Authorization:`Bearer ${config.key}`},signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw new PosterError('poster_store_unavailable',503);
 return response.json();
}
export async function readPurchases(config:StoreConfig,userId:string,send:typeof fetch=fetch):Promise<VerifiedPurchase[]>{
 if(!uuid(userId))throw new PosterError('poster_store_identity',409);
 return readPurchasePages(config,`/v2/projects/${config.project}/customers/${userId}/purchases`,userId,send);
}
export async function readTransaction(config:StoreConfig,transaction:string,send:typeof fetch=fetch):Promise<VerifiedPurchase[]>{
 if(!transaction||transaction.length>200)throw new PosterError('poster_invalid_input');
 return readPurchasePages(config,`/v2/projects/${config.project}/purchases`,null,send,'?store_purchase_identifier='+encodeURIComponent(transaction));
}
async function readPurchasePages(config:StoreConfig,base:string,expectedUser:string|null,send:typeof fetch,query=''){
 const observedMs=Date.now();let path:string|null=base+(query||'?limit=100');const products=new Map<string,string|null>();const result:VerifiedPurchase[]=[];
 const seen=new Set<string>();let pages=0;
 while(path){
  if(++pages>20||seen.has(path))throw new PosterError('poster_store_unavailable',503);seen.add(path);
  const page=await read(config,path,send);
  if(!Array.isArray(page.items))throw new PosterError('poster_store_unavailable',503);
  for(const purchase of page.items){
   if(purchase?.environment!=='production'||purchase?.store!=='app_store')continue;
   const id=purchase.product_id;
   if(typeof id!=='string'||!/^prod[a-zA-Z0-9]+$/.test(id))throw new PosterError('poster_store_unavailable',503);
   if(!products.has(id)){
    const product=await read(config,`/v2/projects/${config.project}/products/${id}`,send);
    products.set(id,product.app_id===config.app&&product.one_time?.is_consumable===true&&POSTER_PRODUCTS.includes(product.store_identifier)?product.store_identifier:null);
   }
   const product=products.get(id);if(!product)continue;
   if(!['owned','refunded'].includes(purchase.status))continue;
   const userId=uuid(purchase.original_customer_id)?purchase.original_customer_id:purchase.customer_id;
   // Consumable balances stay with the original authenticated buyer; never merge app accounts.
   if(!uuid(userId)||(expectedUser&&userId!==expectedUser))continue;
   const quantity=purchase.quantity??1;
   if(typeof purchase.store_purchase_identifier!=='string'||!purchase.store_purchase_identifier||purchase.store_purchase_identifier.length>200||!Number.isInteger(quantity)||quantity<1||quantity>10)throw new PosterError('poster_store_unavailable',503);
   result.push({userId,transaction:purchase.store_purchase_identifier,product,quantity,refunded:purchase.status==='refunded',observedMs});
  }
  if(page.next_page==null){path=null;continue;}
  const next=new URL(page.next_page,'https://api.revenuecat.com');
  if(next.origin!=='https://api.revenuecat.com'||next.pathname!==base)throw new PosterError('poster_store_unavailable',503);
  path=next.pathname+next.search;
 }
 return result;
}
export function webhookTransaction(body:unknown,appId:string):string|null{
 const event=(body as any)?.event;
 if(!event||typeof event.type!=='string')throw new PosterError('poster_invalid_input');
 if(event.type==='TEST')return null;
 if(event.environment!=='PRODUCTION'||event.app_id!==appId||event.store!=='APP_STORE'||!POSTER_PRODUCTS.includes(event.product_id))return null;
 if(!['NON_RENEWING_PURCHASE','CANCELLATION','REFUND_REVERSED'].includes(event.type))return null;
 if(typeof event.transaction_id!=='string'||!event.transaction_id||event.transaction_id.length>200)throw new PosterError('poster_invalid_input');
 return event.transaction_id;
}
export async function secretEquals(actual:string,expected:string){
 const digest=async(s:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
 const [a,b]=await Promise.all([digest(actual),digest(expected)]);let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;
}
export async function promotionIdentity(email:string,salt:string){
 if(salt.length<32)throw new PosterError('poster_promotion_unavailable',503);
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(salt),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(email.trim().toLowerCase())))).map(n=>n.toString(16).padStart(2,'0')).join('');
}
// Welcome eligibility follows an active Pro entitlement, including trials, shared and test access.
// This does not change production-only validation of purchased credit transactions above.
export function verifiedPro(info:any,now=Date.now()){
 const e=info?.subscriber?.entitlements?.['DJ Planner Pro'];
 if(!e||typeof e.product_identifier!=='string')return false;
 const subscription=info.subscriber.subscriptions?.[e.product_identifier];
 if(subscription?.refunded_at)return false;
 const expiry=Math.max(e.expires_date===null?Infinity:Date.parse(e.expires_date),Date.parse(e.grace_period_expires_date??'')||0);
 return expiry>now;
}
