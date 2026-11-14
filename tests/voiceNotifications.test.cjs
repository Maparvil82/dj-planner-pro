const {test}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const fs=require('node:fs');
const ts=require('typescript');
test('session notifications preserve other alerts, deduplicate, share capacity and handle date/account changes',async()=>{
 const oldLoad=Module._load,oldTs=require.extensions['.ts'];
 const scheduled=new Map([['unrelated',{identifier:'unrelated',content:{body:'Existing app notification'}}]]);
 let writes=0,native=true;
 const api={SchedulableTriggerInputTypes:{DATE:'date'},getAllScheduledNotificationsAsync:async()=>[...scheduled.values()],
   cancelScheduledNotificationAsync:async id=>{scheduled.delete(id)},
   scheduleNotificationAsync:async item=>{writes++;scheduled.set(item.identifier,item);return item.identifier;}};
 Module._load=function(name,...args){
   if(name==='react-native')return{Platform:{OS:'ios'}};
   if(name==='expo')return{requireOptionalNativeModule:()=>native?{}:null};
   if(name==='expo-notifications')return api;
   return oldLoad.call(this,name,...args);
 };
 require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
 try {
  const {syncVoiceNotifications,syncSessionNotifications,voiceNotificationsAvailable}=require('../src/services/voiceNotifications.ts');
  const row={note_id:'n',session_id:'s',venue:'Zoco',title:'Monitor',date:'2099-01-02',start_time:'22:00',booking_timezone:'Europe/Madrid'};
  await syncVoiceNotifications([row],'Voice',venue=>'Pending '+venue);
  assert.equal(writes,1);assert.equal(scheduled.size,2);
  await syncVoiceNotifications([row],'Voice',venue=>'Pending '+venue);
  assert.equal(writes,1,'Unchanged polling does not reschedule');
  await syncVoiceNotifications([{...row,date:'2099-02-02'}],'Voice',venue=>'Pending '+venue);
  assert.equal(writes,2);assert.equal(scheduled.size,2,'Date edits replace the original alert');
  await syncVoiceNotifications([],'Voice',venue=>venue);
  assert.deepEqual([...scheduled.keys()],['unrelated'],'Resolution, cancellation, logout or loss of PRO clear only voice alerts');
  native=false;
  assert.equal(voiceNotificationsAvailable(),false,'Old app binaries stay usable');
  await syncVoiceNotifications([row],'Voice',venue=>venue);assert.equal(writes,2);
  native=true;
  const text={voiceTitle:'Voice',voiceBody:venue=>'Before '+venue,reviewTitle:venue=>'How was '+venue+'?',reviewBody:'Complete the session or leave a note.'};
  const review={id:'review',user_id:'owner',date:'2099-01-01',start_time:'22:00',end_time:'04:00',venue:'Zoco',booking_timezone:'Europe/Madrid',status:'confirmed'};
  await syncSessionNotifications([row],[review],'owner',text);
  assert.equal(scheduled.size,3,'Voice and follow-up coexist');
  const follow=scheduled.get('dj-session-review:review');
  assert.equal(follow.content.title,'How was Zoco?');
  assert.equal(follow.content.data.sessionReviewId,'review');
  assert.equal(follow.trigger.date.toISOString(),'2099-01-03T03:00:00.000Z');
  await syncSessionNotifications(null,null,'owner',text);
  assert.equal(scheduled.size,3,'Network failures keep known alerts for the current account');
  await syncSessionNotifications([],[{...review,date:'2099-02-01'}],'owner',text);
  assert.equal(scheduled.size,2,'Losing PRO removes voice alerts but keeps the free follow-up');
  assert.equal(scheduled.get('dj-session-review:review').trigger.date.toISOString(),'2099-02-03T03:00:00.000Z');
  await syncSessionNotifications([],[{...review,status:'cancelled'}],'owner',text);
  assert.deepEqual([...scheduled.keys()],['unrelated'],'Cancellation clears the follow-up');
  const many=Array.from({length:80},(_,i)=>({...review,id:'many-'+i}));
  await syncSessionNotifications([row],many,'owner',text);
  assert.equal(scheduled.size,60,'Both reminder types share a safe device capacity');
  assert.ok(scheduled.has('unrelated'));
  await syncSessionNotifications(null,null,'other',text);
  assert.deepEqual([...scheduled.keys()],['unrelated'],'Account switch removes previous-account notifications');
  await syncSessionNotifications([],[review],'owner',text);
  await syncSessionNotifications([],[],undefined,text);
  assert.deepEqual([...scheduled.keys()],['unrelated'],'Sign-out removes managed notifications');

 }finally{Module._load=oldLoad;require.extensions['.ts']=oldTs;}
});
