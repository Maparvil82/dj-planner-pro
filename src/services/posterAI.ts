import { captureOperationFailure, startOperation } from '../monitoring';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { supabase } from '../lib/supabase';

export type PosterPhoto = {name:string;dataUrl:string;uri:string};
export type PosterAIForm = {title:string;djs:string[];date:string;time:string;venue:string;style:string;format:string};
export type PosterAIJob = {sessionPosterApplied?:boolean;imageMime?:'image/jpeg'|'image/png';isPublished?:boolean;id:string;status:'running'|'complete'|'failed'|'uncertain';sessionId:string;parentId:string|null;form:PosterAIForm;instruction:string|null;imageUrl:string|null;errorCode:string|null;usage:unknown;createdAt:string};
export type PosterAIBudget = {proActive?:boolean;credits?:number;sandboxPurchasesEnabled?:boolean;promotionClaimedCredits?:number;paidCredits?:number;bonusCredits?:number;purchasesEnabled?:boolean;promotionAvailable?:boolean;testCredits?:number;testReservedCredits?:number;creditMode?:string;configured:boolean;enabled:boolean;canGenerate?:boolean;available_eur_cents?:number;accounted_eur_cents?:number;reservation_eur_cents?:number;remainingOperations:number;attempts:number;limit_eur_cents:number;reserved_eur_cents:number};
const messages:Record<string,string>={poster_session_poster_changed:'El cartel de esta sesión ha cambiado. Vuelve a elegirla y confirma si quieres sustituirlo.',poster_store_unavailable:'No se ha podido verificar la compra con la tienda. No vuelvas a comprar: comprueba tus créditos de nuevo en unos instantes.',poster_credits_empty:'No tienes créditos suficientes. Puedes añadirlos desde tu saldo.',
  poster_generation_interrupted:'No hemos podido recuperar este cartel. El crédito reservado se ha liberado y puedes volver a intentarlo.',
  poster_not_sent:'No se ha podido iniciar la generación. Tu crédito se ha liberado.',
  poster_store_identity:'Esta compra está vinculada a otra cuenta de DJ Planner. Entra con la cuenta con la que la compraste.',
  poster_credit_sync_unavailable:'No se han podido actualizar tus créditos. Vuelve a entrar en Carteles en unos instantes.',
  poster_promotion_unavailable:'La promoción no está disponible en este momento.',poster_promotion_claimed:'El regalo de bienvenida ya se ha utilizado.',
  poster_provider_quota_reconciled:'El intento fue rechazado por cuota; su reserva de prueba ya se ha liberado.',
  poster_trial_expired:'La prueba gratuita de Google ha terminado. La generación está pausada.',
  poster_not_configured:'La generación de carteles no está disponible en este momento.',poster_disabled:'La generación de carteles está pausada.',poster_forbidden:'Carteles todavía no está disponible para tu cuenta.',poster_unauthorized:'Vuelve a iniciar sesión para continuar.',poster_budget_exhausted:'Se ha alcanzado el límite de generación del servicio. Tus créditos se conservan.',poster_busy:'Ya hay un cartel generándose o pendiente de comprobar. Revisa Mis carteles.',poster_session_unavailable:'La sesión debe ser tuya, estar guardada y tener una fecha futura.',poster_parent_unavailable:'No se ha podido recuperar la versión original.',poster_provider_key:'La generación no está disponible. Estamos revisando la conexión con el proveedor.',poster_provider_quota:'El proveedor ha rechazado la petición por cuota, saldo o límite de peticiones.',poster_provider_uncertain:'No se ha podido confirmar el resultado. La reserva se mantiene y no repetiremos la generación automáticamente.',poster_provider_rejected:'El proveedor no ha podido generar este cartel. Revisa las fotos y los datos.',poster_invalid_photos:'Usa hasta tres fotos de menos de 1024 píxeles por lado.',poster_not_found:'No se ha encontrado el cartel.',poster_invalid_input:'Revisa los datos del cartel.',poster_id_conflict:'Esta petición ya se utilizó para otro cartel.',
};
export function posterAIMessage(code:string){return messages[code]||'No se ha podido conectar con la generación de carteles. Vuelve a comprobar el estado antes de generar de nuevo.';}
export type PosterGalleryCursor = {createdAt:string;id:string};
export async function posterAIRequest(body:Record<string,unknown>):Promise<{job?:PosterAIJob;jobs?:PosterAIJob[];nextCursor?:PosterGalleryCursor|null;budget:PosterAIBudget}>{
  const operation = body.action === 'generate' ? (body.parentId ? 'poster.edit' : 'poster.generate') : body.action === 'sync_store' ? 'poster.purchase' : 'poster.other';
  const finish = startOperation(operation);
  try {
    const {data,error}=await supabase.functions.invoke('poster-ai',{body});
    if(error){let code='';try{code=(await error.context?.json())?.error;}catch{/* network or non-JSON gateway response */}throw Object.assign(new Error(posterAIMessage(code)),{code});}
    if(data?.error)throw Object.assign(new Error(posterAIMessage(data.error)),{code:data.error});
    finish(); return data;
  } catch (error) {
    finish(true);
    const code = (error as {code?:string})?.code;
    if (!code || ['poster_server_error','poster_credit_sync_unavailable','poster_store_unavailable','poster_generation_interrupted','poster_timeout','poster_provider_error'].includes(code)) captureOperationFailure(operation,error);
    throw error;
  }
}
export async function pickPosterAIPhoto(name:string):Promise<PosterPhoto|null>{
  const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
  if(!permission.granted)throw new Error('Permite el acceso a tu fototeca para añadir una foto.');
  const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:false,quality:1});
  const asset=result.canceled?null:result.assets?.[0];if(!asset)return null;
  const scale=Math.min(1,1024/Math.max(asset.width,asset.height));
  const photo=await manipulateAsync(asset.uri,[{resize:{width:Math.max(1,Math.round(asset.width*scale)),height:Math.max(1,Math.round(asset.height*scale))}}],{format:SaveFormat.JPEG,compress:0.75,base64:true});
  if(!photo.base64||photo.base64.length>850000)throw new Error('La foto es demasiado grande. Prueba con otra imagen.');
  return {name,uri:photo.uri,dataUrl:`data:image/jpeg;base64,${photo.base64}`};
}
export async function sharePosterAI(job:PosterAIJob){
  // Refresh the signed URL before downloading; never store a permanently public URL.
  const {job:current}=await posterAIRequest({action:'get',id:job.id});
  if(!current?.imageUrl)throw new Error('El cartel todavía no está disponible.');
  if(!await Sharing.isAvailableAsync())throw new Error('No se puede abrir el menú de compartir en este dispositivo.');
  const png=current.imageMime==='image/png';
  const destination=new File(Paths.cache,`poster-${job.id}-${Date.now()}.${png?'png':'jpg'}`);
  const downloaded=await File.downloadFileAsync(current.imageUrl,destination);
  try{await Sharing.shareAsync(downloaded.uri,{mimeType:png?'image/png':'image/jpeg',UTI:png?'public.png':'public.jpeg'});}finally{if(downloaded.exists)downloaded.delete();}
}
