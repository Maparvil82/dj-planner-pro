// Only Apple sandbox transactions can fund the private testing wallet.
export const POSTER_PRODUCTS = ['com.djplannerpro.app.postercredits5','com.djplannerpro.app.postercredits12'];
export function sandboxReceipts(info:unknown):{receipt:string;product:string}[]{
 const data=(info as any)?.subscriber?.non_subscriptions;
 if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Invalid store response');
 const result:{receipt:string;product:string}[]=[];
 for(const product of POSTER_PRODUCTS){
  const entries=data[product]??[];if(!Array.isArray(entries))throw new Error('Invalid transactions');
  for(const t of entries){
   if(t?.is_sandbox!==true||t?.store!=='app_store'||t?.refunded_at)continue;
   if(typeof t.id!=='string'||!t.id||t.id.length>200)throw new Error('Invalid receipt');
   result.push({receipt:t.id,product});
  }
 }
 return result;
}
