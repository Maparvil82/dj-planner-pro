import { createClient } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { authStorage } from '../lib/authStorage';
import type { EntryCountResult } from './entryCounter';

// Door credentials never replace the DJ's Auth session. This client is always anon.
const doorClient = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL || '',process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',{
    auth:{storageKey:'door-transport-v1',persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
});
export interface DoorCredential {id:string;secret:string}
export interface DoorInvitation {id:string;label:string;claimed_at:string|null;revoked_at:string|null;last_seen_at:string|null;qr_count:number;manual_count:number;guest_count:number}
export interface DoorGuest {id:string;full_name:string;companions:number;total:number;admitted:number}
export interface DoorState {session_id:string;title:string;venue:string;date:string;start_time:string;end_time:string;ends_at:string;opens_at:string;label:string;entries:number;guests:DoorGuest[]}
const activeKey='door.active.v1';
const validId=(id:string)=> /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export const validDoorSecret=(key:string)=> /^[0-9a-f]{64}$/.test(key);
const digest=(key:string)=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,key);
const secret=async()=>Array.from(await Crypto.getRandomBytesAsync(32)).map(x=>x.toString(16).padStart(2,'0')).join('');
function check(error:{message:string}|null) {
    if(error) throw new Error(/^(door\.|guests\.changed|tickets\.invalidQr)/.test(error.message) ? error.message : 'tickets.connectionError');
}
export const doorAccess = {
    async list(sessionId:string):Promise<DoorInvitation[]> {
        const {data,error}=await supabase.rpc('door_manage',{p_session:sessionId,p_action:'list'});check(error);return data;
    },
    async invitation(label:string) {return {id:Crypto.randomUUID(),token:await secret(),label:label.trim()};},
    async create(sessionId:string,invite:{id:string;token:string;label:string}):Promise<DoorInvitation[]> {
        const {data,error}=await supabase.rpc('door_manage',{p_session:sessionId,p_action:'create',p_id:invite.id,p_label:invite.label,p_hash:await digest(invite.token),p_zone:Intl.DateTimeFormat().resolvedOptions().timeZone});check(error);return data;
    },
    link(invite:{id:string;token:string}) {return Linking.createURL('door',{queryParams:{invite:invite.id,key:invite.token}});},
    async revoke(sessionId:string,id:string):Promise<DoorInvitation[]> {
        const {data,error}=await supabase.rpc('door_manage',{p_session:sessionId,p_action:'revoke',p_id:id});check(error);return data;
    },
    async active():Promise<DoorCredential|null> {
        try {const raw=await authStorage.getItem(activeKey);if(!raw)return null;const parsed=JSON.parse(raw);return validId(parsed.id)&&validDoorSecret(parsed.secret) ? parsed : null;}catch{return null;}
    },
    async prepare(id:string):Promise<DoorCredential> {
        if(!validId(id))throw new Error('door.unavailable');
        const key=`door.device.${id}`,existing=await authStorage.getItem(key);
        const credential={id,secret:existing&&validDoorSecret(existing)?existing:await secret()};
        // Persist before claiming: a lost network response must be retryable on this device.
        await authStorage.setItem(key,credential.secret);return credential;
    },
    async claim(credential:DoorCredential,token:string) {
        if(!validDoorSecret(token))throw new Error('door.unavailable');
        const {error}=await doorClient.rpc('door_claim',{p_id:credential.id,p_token:token,p_device:credential.secret});check(error);
        await authStorage.setItem(activeKey,JSON.stringify(credential));
    },
    async forget(credential:DoorCredential) {
        const active=await this.active();if(active?.id===credential.id)await authStorage.removeItem(activeKey);
        await authStorage.removeItem(`door.device.${credential.id}`);
    },
    async state(credential:DoorCredential):Promise<DoorState> {
        const {data,error}=await doorClient.rpc('door_state',{p_id:credential.id,p_device:credential.secret});check(error);return data;
    },
    async scan(credential:DoorCredential,code:string):Promise<EntryCountResult> {
        if(!code||code.length>16384)throw new Error('tickets.invalidQr');
        const {data,error}=await doorClient.rpc('door_scan',{p_id:credential.id,p_device:credential.secret,p_hash:await digest(code)});check(error);return data;
    },
    async admit(credential:DoorCredential,requestId:string,guestId:string|null=null,quantity=1) {
        const {error}=await doorClient.rpc('door_admit',{p_id:credential.id,p_device:credential.secret,p_request:requestId,p_guest:guestId,p_quantity:quantity});check(error);
    },
};
