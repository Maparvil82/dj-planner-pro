import {MODEL,SIZES,PosterError,buildPrompt,type JobInput} from './domain.ts';

export const GOOGLE_PROJECT='dj-planner-512422';
export const GOOGLE_MODEL='gemini-3.1-flash-image';
// Stop conservatively at the beginning of the trial's displayed final day.
export const GOOGLE_TRIAL_END=Date.parse('2027-01-21T00:00:00Z');
const oauthEndpoint='https://oauth2.googleapis.com/token';
const ratios:Record<string,string>={Cartel:'2:3',Historia:'9:16',Cuadrado:'1:1'};
type ServiceAccount={project_id:string;client_email:string;private_key:string};
export type ProviderConfig={provider:'openai';key:string}|{provider:'vertex';account:ServiceAccount};

export function providerConfig(env:(name:string)=>string|undefined,now=Date.now()):ProviderConfig{
  const provider=env('POSTER_AI_PROVIDER')??'vertex';
  if(provider==='openai'){
    const key=env('POSTER_OPENAI_API_KEY');
    if(!key)throw new PosterError('poster_not_configured',503);
    return {provider,key};
  }
  if(provider!=='vertex')throw new PosterError('poster_not_configured',503);
  if(now>=GOOGLE_TRIAL_END)throw new PosterError('poster_trial_expired',503);
  // Explicit operator confirmation after inspecting the Bothside billing account.
  // This is not an API check of Google's billing status or remaining credit.
  if(env('POSTER_GOOGLE_TRIAL_CONFIRMED')!=='true')throw new PosterError('poster_not_configured',503);
  let account:ServiceAccount;
  try{account=JSON.parse(env('POSTER_GOOGLE_SERVICE_ACCOUNT_JSON')??'');}
  catch{throw new PosterError('poster_not_configured',503);}
  if(!account||account.project_id!==GOOGLE_PROJECT||typeof account.client_email!=='string'||
    !account.client_email.endsWith('@'+GOOGLE_PROJECT+'.iam.gserviceaccount.com')||
    typeof account.private_key!=='string'||!account.private_key.startsWith('-----BEGIN PRIVATE KEY-----')){
    throw new PosterError('poster_not_configured',503);
  }
  return {provider,account};
}

const base64url=(bytes:Uint8Array)=>{
  let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(binary).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
};
export async function googleAccessToken(account:ServiceAccount,send:typeof fetch=fetch,now=Date.now()){
  const encode=(v:unknown)=>base64url(new TextEncoder().encode(JSON.stringify(v)));
  const issued=Math.floor(now/1000);
  const claim=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:account.client_email,
    scope:'https://www.googleapis.com/auth/cloud-platform',aud:oauthEndpoint,iat:issued,exp:issued+3600});
  let assertion:string;
  try{
    const pem=account.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,'');
    const key=await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(pem),c=>c.charCodeAt(0)),
      {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
    assertion=claim+'.'+base64url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(claim))));
  }catch{throw new PosterError('poster_provider_key',503);}
  // Auth only, never generation. No private key or access token is logged or persisted.
  let response:Response;
  try{response=await send(oauthEndpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(15000)});}
  catch{throw new PosterError('poster_provider_key',503);}
  if(!response.ok)throw new PosterError('poster_provider_key',503);
  const result=await response.json();
  if(typeof result.access_token!=='string'||!result.access_token)throw new PosterError('poster_provider_key',503);
  return result.access_token as string;
}

export async function providerRequest(config:ProviderConfig,input:JobInput,images:{image_url:string}[],send:typeof fetch=fetch){
  if(config.provider==='openai')return {url:'https://api.openai.com/v1/images/edits',
    headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json'},
    body:JSON.stringify({model:MODEL,images,prompt:buildPrompt(input),size:SIZES[input.form.format],quality:'high',n:1,output_format:'jpeg',output_compression:90})};
  const token=await googleAccessToken(config.account,send);
  const parts:unknown[]=[{text:buildPrompt(input,`1K resolution, aspect ratio ${ratios[input.form.format]}`)}];
  for(const image of images){
    const match=/^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/.exec(image.image_url);
    if(!match)throw new PosterError('poster_invalid_photos');
    parts.push({inlineData:{mimeType:match[1],data:match[2]}});
  }
  return {url:`https://aiplatform.googleapis.com/v1/projects/${GOOGLE_PROJECT}/locations/global/publishers/google/models/${GOOGLE_MODEL}:generateContent`,
    headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{candidateCount:1,maxOutputTokens:4096,
      // Raw Vertex REST nests encoding settings; the SDK's flat names are not API fields.
      responseModalities:['TEXT','IMAGE'],imageConfig:{aspectRatio:ratios[input.form.format],imageSize:'1K',imageOutputOptions:{mimeType:'image/jpeg',compressionQuality:90}}}})};
}

export function providerUsage(config:ProviderConfig,result:Record<string,any>){
  if(config.provider==='openai')return result.usage??null;
  // Preserve the provider's counters, including thought tokens, without pretending they are OpenAI tokens.
  return {_provider:'vertex',_model:GOOGLE_MODEL,usageMetadata:result.usageMetadata??null};
}

export function providerOutput(config:ProviderConfig,result:Record<string,any>){
  let b64:unknown;let mime='image/jpeg';
  if(config.provider==='openai')b64=result.data?.[0]?.b64_json;
  else{
    const candidates=result.candidates;
    if(!Array.isArray(candidates)||candidates.length!==1)throw new PosterError('poster_invalid_output');
    const parts=candidates[0]?.content?.parts;
    const images=Array.isArray(parts)?parts.filter(p=>!p.thought&&p.inlineData):[];
    if(images.length!==1)throw new PosterError('poster_invalid_output');
    b64=images[0].inlineData.data;mime=images[0].inlineData.mimeType;
  }
  if(!['image/jpeg','image/png'].includes(mime)||typeof b64!=='string'||b64.length>13981016||!b64.length||!/^[A-Za-z0-9+/]+={0,2}$/.test(b64))throw new PosterError('poster_invalid_output');
  const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  if(bytes.length>10485760||!(mime==='image/png'?
    [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v):bytes[0]===255&&bytes[1]===216&&bytes[2]===255))throw new PosterError('poster_invalid_output');
  return {bytes,mime,extension:mime==='image/png'?'png':'jpg'};
}
