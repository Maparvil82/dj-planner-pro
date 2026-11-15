const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const old=require.extensions['.ts'];
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {voiceReminderPlan}=require('../src/utils/voiceReminders.ts');
require.extensions['.ts']=old;
const row=(extra={})=>({note_id:'note',session_id:'session',venue:'Zoco',title:'Monitor',date:'2031-01-02',start_time:'22:00',booking_timezone:'Europe/Madrid',...extra});
test('voice reminders use venue-local previous day and retain long-term notes',()=>{
 const p=voiceReminderPlan([row()],Date.parse('2030-01-01'));
 assert.equal(p[0].at.toISOString(),'2031-01-01T21:00:00.000Z');
 assert.equal(p[0].identifier,'dj-voice:note:session');
});
test('voice reminders preserve wall time across daylight-saving changes',()=>{
 const [p]=voiceReminderPlan([row({date:'2030-03-31',start_time:'22:00'})],0);
 assert.equal(p.start.toISOString(),'2030-03-31T20:00:00.000Z');
 assert.equal(p.at.toISOString(),'2030-03-30T21:00:00.000Z');
});
test('voice reminders exclude expired delivery times instead of firing immediately',()=>{
 assert.deepEqual(voiceReminderPlan([row()],Date.parse('2031-01-02T10:00:00Z')),[]);
});
test('voice reminder edits keep stable identity and move delivery time',()=>{
 const a=voiceReminderPlan([row()],0)[0],b=voiceReminderPlan([row({date:'2031-02-02'})],0)[0];
 assert.equal(a.identifier,b.identifier);assert.notEqual(a.at.getTime(),b.at.getTime());
});
