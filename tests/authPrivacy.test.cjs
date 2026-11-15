const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
test('legacy duplicate credentials are discarded; profiles never persist and account changes clear them',async()=>{
 const storage=new Map([['dj-auth-storage-v2',JSON.stringify({version:0,state:{session:{access_token:'old-secret'},user:{id:'old'},profile:{email:'private@example.test'},hasSeenOnboarding:true}})]]);
 const adapter={getItem:async k=>storage.get(k)??null,setItem:async(k,v)=>{storage.set(k,v)},removeItem:async k=>{storage.delete(k)}};
 const mod={exports:{}};let failLogout=false;
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/store/useAuthStore.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module:mod,exports:mod.exports,require:name=>{
  if(name==='@react-native-async-storage/async-storage')return adapter;
  if(name.includes('lib/supabase'))return {supabase:{auth:{signOut:async()=>({error:failLogout?new Error('NETWORK'):null})}}};
  return require(name);
 }});
 const store=mod.exports.useAuthStore;await store.persist.rehydrate();
 assert.equal(store.getState().session,null);assert.equal(store.getState().profile,null);assert.equal(store.getState().hasSeenOnboarding,true);
 store.getState().setSession({user:{id:'a'},access_token:'new-secret'});store.getState().setProfile({email:'private@example.test'});
 await new Promise(resolve=>setImmediate(resolve));const persisted=storage.get('dj-auth-storage-v2');assert(!persisted.includes('secret'));assert(!persisted.includes('email'));assert(!persisted.includes('session'));
 store.getState().setSession({user:{id:'b'}});assert.equal(store.getState().profile,null);failLogout=true;await assert.rejects(store.getState().signOut(),/NETWORK/);assert.equal(store.getState().user.id,'b');failLogout=false;await store.getState().signOut();assert.equal(store.getState().user,null);
});
