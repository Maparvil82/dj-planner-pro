// Non-mutating checks against the configured project. Never prints API keys.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {parse}=require('dotenv');
const env=parse(fs.readFileSync('.env'));
const id='00000000-0000-4000-8000-000000000000';
async function rpc(name,body){const response=await fetch(env.EXPO_PUBLIC_SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:env.EXPO_PUBLIC_SUPABASE_ANON_KEY,Authorization:'Bearer '+env.EXPO_PUBLIC_SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});return {status:response.status,body:await response.json()};}
(async()=>{
 for(const [name,body] of [
  ['door_state',{p_id:id,p_device:'a'.repeat(64)}],
  ['door_claim',{p_id:id,p_token:'a'.repeat(64),p_device:'b'.repeat(64)}],
  ['door_scan',{p_id:id,p_device:'a'.repeat(64),p_hash:'b'.repeat(64)}],
  ['door_admit',{p_id:id,p_device:'a'.repeat(64),p_request:id}],
 ]){const r=await rpc(name,body);assert.equal(r.status,400);assert.equal(r.body.message,'door.unavailable');}
 const denied=await rpc('door_manage',{p_session:id,p_action:'list'});assert.ok([401,403].includes(denied.status));assert.equal(denied.body.code,'42501');
 console.log('PASS: deployed anonymous RPCs reject invalid capabilities; owner management denied to anonymous clients; no records written');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
