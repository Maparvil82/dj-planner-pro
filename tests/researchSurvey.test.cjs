const {test}=require('node:test'), assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/researchSurvey.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports});
const s=mod.exports, base={profile:'self_employed',frequency:'one_two',tools:['calendar'],time:'one_three',priorities:['payments_due']};
test('single priority is resolved automatically; no gigs omits the irrelevant free text',()=>{
 assert(s.surveyAnswersValid(base));assert.equal(s.normalizeSurveyAnswers(base).first,'payments_due');
 assert(!s.surveyQuestionsFor(base).some(q=>q.id==='first'));
 const none={...base,frequency:'none',recent:'old hidden text'};assert(!s.surveyQuestionsFor(none).some(q=>q.id==='recent'));assert.equal(s.normalizeSurveyAnswers(none).recent,undefined);
});
test('multiple priorities require choosing one of those selected, and changing them clears stale priority',()=>{
 const a={...base,priorities:['payments_due','invoices']};assert(!s.surveyAnswersValid(a));assert(s.surveyAnswersValid({...a,first:'invoices'}));assert(!s.surveyAnswersValid({...a,first:'cash_forecast'}));
 assert.equal(s.normalizeSurveyAnswers({...base,first:'invoices'}).first,'payments_due');
 assert.equal(s.normalizeSurveyAnswers({...base,priorities:['none'],first:'payments_due'}).first,undefined);
});
test('none is exclusive, three-choice limit is enforced and duplicates cannot be sent',()=>{
 assert.deepEqual(Array.from(s.toggleSurveyOption(['calendar'],'none')),['none']);assert.deepEqual(Array.from(s.toggleSurveyOption(['none'],'calendar')),['calendar']);
 assert.equal(s.toggleSurveyOption(['a','b','c'],'d',3).length,3);
 assert(!s.surveyAnswersValid({...base,priorities:['none','invoices']}));assert(!s.surveyAnswersValid({...base,tools:['calendar','calendar']}));
 assert(!s.surveyAnswersValid({...base,priorities:['invoices','payments_due','expense_receipts','cash_forecast'],first:'invoices'}));
});
test('optional texts have limits and stale other details are removed',()=>{
 assert(!s.surveyAnswersValid({...base,additional:'a'.repeat(1501)}));
 assert(!s.surveyAnswersValid({...base,tools:['other'],toolsOther:'a'.repeat(301)}));
 assert.equal(s.normalizeSurveyAnswers({...base,toolsOther:'old detail'}).toolsOther,undefined);
});
