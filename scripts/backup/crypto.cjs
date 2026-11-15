const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {pipeline}=require('node:stream/promises');
const MAGIC=Buffer.from('DJPLANNER-BACKUP-1\n');
function key(value){if(!/^[a-f0-9]{64}$/i.test(value))throw Error('Invalid backup key');return Buffer.from(value,'hex')}
async function transform(mode,source,destination,keyHex){
 const temporary=destination+'.partial-'+crypto.randomUUID();
 try{
  const stat=await fsp.stat(source);let stream;
  if(mode==='encrypt'){
   const nonce=crypto.randomBytes(12),header=Buffer.concat([MAGIC,nonce]);
   const cipher=crypto.createCipheriv('aes-256-gcm',key(keyHex),nonce);cipher.setAAD(header);
   await fsp.writeFile(temporary,header,{mode:0o600,flag:'wx'});
   await pipeline(fs.createReadStream(source),cipher,fs.createWriteStream(temporary,{flags:'a'}));
   await fsp.appendFile(temporary,cipher.getAuthTag());
  }else if(mode==='decrypt'){
   if(stat.size<MAGIC.length+28)throw Error('Truncated backup');
   const handle=await fsp.open(source,'r');const header=Buffer.alloc(MAGIC.length+12),tag=Buffer.alloc(16);
   try{await handle.read(header,0,header.length,0);await handle.read(tag,0,16,stat.size-16)}finally{await handle.close()}
   if(!header.subarray(0,MAGIC.length).equals(MAGIC))throw Error('Invalid backup header');
   const decipher=crypto.createDecipheriv('aes-256-gcm',key(keyHex),header.subarray(MAGIC.length));decipher.setAAD(header);decipher.setAuthTag(tag);
   await pipeline(fs.createReadStream(source,{start:header.length,end:stat.size-17}),decipher,fs.createWriteStream(temporary,{flags:'wx',mode:0o600}));
  }else throw Error('Unknown mode');
  // link is exclusive: never overwrite a previous backup or a restored file.
  await fsp.link(temporary,destination);await fsp.unlink(temporary);
 }catch(error){await fsp.rm(temporary,{force:true});throw error}
}
module.exports={transform};
if(require.main===module){
 (async()=>{const [mode,source,destination,keyFile]=process.argv.slice(2);const stat=await fsp.stat(keyFile);if(stat.mode&0o077)throw Error('Backup key file must be private');const text=await fsp.readFile(keyFile,'utf8');const match=text.match(/^BACKUP_RECOVERY_KEY=([a-f0-9]{64})$/mi);if(!match)throw Error('Backup recovery key is missing');await transform(mode,source,destination,match[1]);console.log('Backup '+mode+' verified');})().catch(()=>{console.error('Backup cryptographic operation failed; no completed destination was created.');process.exitCode=1});
}
