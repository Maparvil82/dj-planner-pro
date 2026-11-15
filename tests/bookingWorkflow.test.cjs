const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const original=require.extensions['.ts'];
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {validBookingSchedule,bookingAmount,currentProposal,canAcceptProposal,bookingErrorKey}=require('../src/utils/bookingWorkflow.ts');
if(original)require.extensions['.ts']=original;else delete require.extensions['.ts'];
test('booking schedule supports overnight sets but rejects impossible dates, clocks and identical times',()=>{
 assert.equal(validBookingSchedule({date:'2027-01-01',start_time:'22:00',end_time:'04:00'}),true);
 for(const x of [{date:'2027-02-29',start_time:'22:00',end_time:'04:00'},{date:'2027-01-01',start_time:'24:00',end_time:'04:00'},{date:'2027-01-01',start_time:'22:00',end_time:'22:00'}])assert.equal(validBookingSchedule(x),false);
});
test('budgets accept zero and decimal commas without interpreting ambiguous numbers',()=>{
 assert.equal(bookingAmount('0'),0);assert.equal(bookingAmount(' 450,50 '),450.5);
 for(const x of ['-1','1e3','1.234,56','1.005','','100000000'])assert.equal(bookingAmount(x),null);
});
test('only the latest unchanged and unexpired proposal can be accepted',()=>{
 const thread={request:{state:'proposed',latest_proposal_id:'v2'},proposals:[{id:'v1',expires_at:'2027-01-03T12:00:00Z'},{id:'v2',expires_at:'2027-01-02T12:00:00Z'}]};
 assert.equal(currentProposal(thread).id,'v2');assert.equal(canAcceptProposal(thread,Date.parse('2027-01-01')),true);
 assert.equal(canAcceptProposal(thread,Date.parse('2027-01-02T12:00:00Z')),false);
 for(const state of ['negotiating','accepted','declined','closed'])assert.equal(canAcceptProposal({...thread,request:{...thread.request,state}},Date.parse('2027-01-01')),false);
 assert.equal(canAcceptProposal({...thread,request:{state:'proposed',latest_proposal_id:'missing'}},Date.parse('2027-01-01')),false);
});
test('internal SQL errors are replaced with a localized product message',()=>{
 assert.equal(bookingErrorKey('schedule_conflict'),'schedule_conflict');
 assert.equal(bookingErrorKey('permission denied for table booking_private.guest_access'),'temporarily_unavailable');
 assert.equal(bookingErrorKey(null),'temporarily_unavailable');
});
test('booking UI, states, errors and notifications have matching keys in all seven languages',()=>{
 const languages=['es','en','de','fr','it','pt','ja'];
 const flatten=(value,prefix='')=>Object.entries(value).flatMap(([key,v])=>typeof v==='string'?[prefix+key]:flatten(v,prefix+key+'.'));
 let expected;
 for(const lang of languages){const copy=JSON.parse(fs.readFileSync(path.join(__dirname,'../src/i18n/languages',lang+'.json')));const keys=flatten(copy.bookings).sort();if(expected)assert.deepEqual(keys,expected,lang);expected=keys;for(const key of ['booking_request','booking_message','booking_confirmed'])assert.ok(copy.notifications[key],`${lang} ${key}`);}
});
