const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const m={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/secureSessionStorage.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports});
function fixture(){
 const encrypted=new Map(),plain=new Map();let generation=0,fail=false;
 const secure={getItem:async k=>encrypted.get(k)??null,setItem:async(k,v)=>{if(fail&&k.endsWith('.1'))throw Error('LOCKED');assert(Buffer.byteLength(v)<=2048);encrypted.set(k,v);},removeItem:async k=>{encrypted.delete(k)}};
 const legacy={getItem:async k=>plain.get(k)??null,setItem:async(k,v)=>{plain.set(k,v)},removeItem:async k=>{plain.delete(k)}};
 return {encrypted,plain,setFailure:v=>{fail=v},storage:m.exports.createSecureSessionStorage(secure,legacy,()=>`generation-${++generation}`)};
}
test('migrates a large Unicode session without plaintext or oversized Keychain values',async()=>{
 const f=fixture(),session=JSON.stringify({access_token:'token',user:{description:'🎧'.repeat(3000)}});
 f.plain.set('sb-session',session);assert.equal(await f.storage.getItem('sb-session'),session);assert.equal(f.plain.size,0);
 assert.equal(await f.storage.getItem('sb-session'),session);
 await f.storage.removeItem('sb-session');assert.equal(f.encrypted.size,0);assert.equal(await f.storage.getItem('sb-session'),null);
});
test('failed encrypted write preserves the previous committed session and never falls back to plaintext',async()=>{
 const f=fixture();await f.storage.setItem('session','previous');f.setFailure(true);
 await assert.rejects(f.storage.setItem('session','new'.repeat(1000)),/LOCKED/);
 assert.equal(await f.storage.getItem('session'),'previous');assert.equal(f.plain.size,0);assert.equal(f.encrypted.size,2);
});
test('serialized concurrent writes and logout leave no recoverable legacy token',async()=>{
 const f=fixture();await Promise.all([f.storage.setItem('session','first'),f.storage.setItem('session','second')]);
 assert.equal(await f.storage.getItem('session'),'second');assert.equal(f.encrypted.size,2);
 f.plain.set('session','legacy');await f.storage.removeItem('session');assert.equal(f.plain.size,0);assert.equal(f.encrypted.size,0);
});
test('incomplete encrypted data is rejected instead of restoring an old plaintext token',async()=>{
 const f=fixture();await f.storage.setItem('session','value');f.encrypted.delete('dj.auth.session.generation-1.0');f.plain.set('session','stale');
 await assert.rejects(f.storage.getItem('session'),/INCOMPLETE_SESSION_STORAGE/);
});
