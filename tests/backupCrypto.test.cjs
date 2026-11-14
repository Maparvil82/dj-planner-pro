const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {transform}=require('../scripts/backup/crypto.cjs');
test('backup encryption restores exact bytes, rejects tampering/wrong keys and never overwrites previous copies',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dj-backup-crypto-'));try{
 const source=path.join(dir,'source'),archive=path.join(dir,'encrypted'),restored=path.join(dir,'restored'),key=crypto.randomBytes(32).toString('hex'),data=crypto.randomBytes(1024*1024+13);
 await fs.writeFile(source,data);await transform('encrypt',source,archive,key);assert.equal((await fs.stat(archive)).mode&0o077,0);
 await transform('decrypt',archive,restored,key);assert((await fs.readFile(restored)).equals(data));
 await assert.rejects(transform('encrypt',source,archive,key));await assert.rejects(transform('decrypt',archive,path.join(dir,'wrong'),crypto.randomBytes(32).toString('hex')));
 const altered=await fs.readFile(archive);altered[50]^=1;const bad=path.join(dir,'corrupt');await fs.writeFile(bad,altered);await assert.rejects(transform('decrypt',bad,path.join(dir,'bad-result'),key));
 const names=await fs.readdir(dir);assert(!names.some(name=>name.startsWith('wrong')||name.startsWith('bad-result')||name.includes('.partial-')));
 }finally{await fs.rm(dir,{recursive:true,force:true})}
});
