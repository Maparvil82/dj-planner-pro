import {createClient} from 'npm:@supabase/supabase-js@2.99.1';
import {webhookHandler} from './handler.ts';
import {PosterError} from '../poster-ai/domain.ts';
const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(webhookHandler(name=>Deno.env.get(name),async p=>{
 const {error}=await admin.rpc('poster_apply_purchase',{p_user:p.userId,p_transaction:p.transaction,p_product:p.product,p_quantity:p.quantity,p_refunded:p.refunded,p_observed_ms:p.observedMs});
 if(error)throw new PosterError('poster_store_unavailable',503);
}));
