const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const old=require.extensions['.ts'];
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {postSessionReminderPlan,sessionNotificationTarget}=require('../src/utils/postSessionReminders.ts');
require.extensions['.ts']=old;
const row=(extra={})=>({id:'session',user_id:'owner',date:'2030-01-01',start_time:'22:00',end_time:'04:00',venue:'Zoco',booking_timezone:'Europe/Madrid',status:'confirmed',...extra});
test('post-session follow-up is 24 hours after overnight end, not after start',()=>{
 const [item]=postSessionReminderPlan([row()],'owner',0);
 assert.equal(item.at.toISOString(),'2030-01-03T03:00:00.000Z');
 assert.equal(item.identifier,'dj-session-review:session');
});
test('post-session follow-up uses 24 elapsed hours even across DST',()=>{
 const [item]=postSessionReminderPlan([row({date:'2030-03-30',start_time:'20:00',end_time:'22:00'})],'owner',0);
 assert.equal(item.at.toISOString(),'2030-03-31T21:00:00.000Z');
});
test('cancelled, guest, other-account, expired and malformed sessions never trigger follow-ups',()=>{
 const now=Date.parse('2030-01-04T00:00:00Z');
 assert.deepEqual(postSessionReminderPlan([row(),row({id:'cancel',status:'cancelled',date:'2031-01-01'}),row({id:'guest',is_guest:true,date:'2031-01-01'}),row({id:'other',user_id:'other',date:'2031-01-01'}),row({id:'invalid',booking_timezone:'invalid'})],'owner',now),[]);
});
test('follow-up identity stays stable across edits; repeated source rows do not duplicate alerts',()=>{
 const first=postSessionReminderPlan([row(),row()],'owner',0);
 const second=postSessionReminderPlan([row({date:'2030-02-01'})],'owner',0);
 assert.equal(first.length,1);assert.equal(first[0].identifier,second[0].identifier);
 assert.notEqual(first[0].at.getTime(),second[0].at.getTime());
});
test('follow-up opens the original session and respects the signed-in account',()=>{
 const data={sessionReviewId:'session',notificationUserId:'owner'};
 assert.deepEqual(sessionNotificationTarget(data,'owner'),{pathname:'/session/[id]',params:{id:'session',postSessionReview:'1'}});
 assert.equal(sessionNotificationTarget(data,'other'),null);
 assert.equal(sessionNotificationTarget(data),null);
 assert.deepEqual(sessionNotificationTarget({voiceSessionId:'session'},'owner'),{pathname:'/session-notice',params:{sessionId:'session',voiceReminder:'1'}});
});
