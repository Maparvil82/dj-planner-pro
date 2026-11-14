const {test}=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');
const fs=require('node:fs');
const Module=require('node:module');
const file=require('node:path').resolve(__dirname,'../src/utils/voiceRecordingFlow.ts');
const m=new Module(file,module);
m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {voiceRecordingTransition:next}=m.exports;
test('recording asks to keep audio, then requests its name, then asks about the next visit',()=>{
 let step='closed';
 for(const [event,expected] of [['START','preparing'],['READY','recording'],['STOPPED','review'],['KEEP','name'],['NAMED','reminder'],['SAVE','saving'],['SAVED','closed']]){
  step=next(step,event);assert.equal(step,expected);
 }
});
test('audio cannot be uploaded from the recording, review or naming steps',()=>{
 for(const step of ['closed','preparing','recording','review','name'])assert.equal(next(step,'SAVE'),step);
 assert.equal(next('review','NAMED'),'review');
});
test('discard returns to the session, while failed uploads retain the final decision step for retry',()=>{
 for(const step of ['review','name','reminder'])assert.equal(next(step,'DISCARD'),'closed');
 assert.equal(next('saving','FAILED'),'reminder');
 assert.equal(next('preparing','FAILED'),'closed');
 assert.equal(next('recording','FAILED'),'closed');
});
