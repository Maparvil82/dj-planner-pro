const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {QueryClient}=require('@tanstack/react-query');
test('intro completion updates its original account only and never dismisses on failed save',async()=>{
 let viewer='a',mutation,query,reply;
 const client=new QueryClient(),mod={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/hooks/usePosterIntro.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:mod,exports:mod.exports,require:name=>{
 if(name==='expo-router')return {useIsFocused:()=>true};
 if(name.includes('useAuthStore'))return {useAuthStore:fn=>fn({session:{user:{id:viewer}}})};
 if(name.includes('supabase'))return {supabase:{rpc:()=>new Promise(resolve=>{reply=resolve})}};
 if(name==='@tanstack/react-query')return {useQueryClient:()=>client,useQuery:options=>{query=options;return {}},useMutation:options=>{mutation=options;return {}}};
 throw Error(name);
 }});
 mod.exports.usePosterIntro();assert.equal(query.enabled,true);assert.equal(query.queryKey[1],'a');
 const first=mutation,pending=first.mutationFn();viewer='b';mod.exports.usePosterIntro();reply({data:true});first.onSuccess(await pending);
 assert.equal(client.getQueryData(['poster-intro','a']),true);assert.equal(client.getQueryData(['poster-intro','b']),undefined);
 const failed=mutation.mutationFn();reply({error:new Error('offline')});await assert.rejects(failed,/offline/);assert.equal(client.getQueryData(['poster-intro','b']),undefined);client.clear();
});
