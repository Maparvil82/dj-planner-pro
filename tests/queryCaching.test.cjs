const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const { QueryClient } = require('@tanstack/react-query');
function hookFixture(file) {
 let viewer='viewer-a', queries, options;
 const calls=[];
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 const mod={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,require: name=>{
  if(name.includes('useAuthStore'))return {useAuthStore: select=>select({session:{user:{id:viewer}}})};
  if(name.includes('CommunityTerms'))return {useCommunityTerms:()=>async()=>true};
  if(name==='expo-router')return {useIsFocused:()=>false};
  if(name==='@tanstack/react-query')return {useQueryClient:()=>client,useQueries:args=>{queries=args.queries;return queries.map(()=>({isPending:false,data:{}}));},useQuery:args=>{options=args;return {};},useInfiniteQuery:args=>{options=args;return {};}};
  if(name.includes('services/community'))return {PAGE_SIZE:20,communityService:{sessionCounts:async ids=>{calls.push({viewer,ids:[...ids]});return Object.fromEntries(ids.map(id=>[id,1]));}}};
  if(name.includes('services/notifications'))return {NOTIFICATION_PAGE_SIZE:20,notificationService:{unread:async()=>0}};
  throw new Error(name);
 }});
 return {hooks:mod.exports,client,calls,get queries(){return queries},get options(){return options},setViewer:id=>{viewer=id}};
}
test('adding a DJ page fetches only new counts; changing accounts never reuses their cache',async()=>{
 const f=hookFixture('src/hooks/useCommunityQuery.ts');const ids=Array.from({length:40},(_,i)=>`dj-${i}`);
 f.hooks.useCommunitySessionCounts(ids.slice(0,20));await Promise.all(f.queries.map(q=>f.client.fetchQuery(q)));
 f.hooks.useCommunitySessionCounts(ids);await Promise.all(f.queries.map(q=>f.client.fetchQuery(q)));
 assert.equal(f.calls.length,2);assert.deepEqual(f.calls[1].ids,ids.slice(20));
 f.setViewer('viewer-b');f.hooks.useCommunitySessionCounts(ids);await Promise.all(f.queries.map(q=>f.client.fetchQuery(q)));
 assert.equal(f.calls.length,4);assert(f.calls.slice(2).every(call=>call.viewer==='viewer-b'));
 f.client.clear();
});
test('badge observers share the polling key and only the root polls; hidden inbox does not poll',()=>{
 const f=hookFixture('src/hooks/useNotifications.ts');
 f.hooks.useUnreadNotifications(true);const root=f.options;
 f.hooks.useUnreadNotifications();const badge=f.options;
 assert.deepEqual([...root.queryKey],[...badge.queryKey]);assert.equal(root.refetchInterval,60000);assert.equal(badge.refetchInterval,false);
 f.hooks.useNotifications();assert.equal(f.options.enabled,false);assert.equal(f.options.refetchInterval,false);f.client.clear();
});
