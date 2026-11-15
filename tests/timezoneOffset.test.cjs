const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const m = {exports:{}};
new Function('exports',ts.transpileModule(fs.readFileSync('src/utils/timezoneOffset.ts','utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText)(m.exports);
const {formatTimezoneOffset} = m.exports;
test('Madrid label follows the selected date across daylight saving changes',()=>{
 assert.equal(formatTimezoneOffset('Europe/Madrid','2026-10-16'),'GMT+2');
 assert.equal(formatTimezoneOffset('Europe/Madrid','2026-10-26'),'GMT+1');
 assert.equal(formatTimezoneOffset('Europe/Madrid','2026-03-28'),'GMT+1');
 assert.equal(formatTimezoneOffset('Europe/Madrid','2026-03-29'),'GMT+2');
});
test('offset labels handle zero, negative, fractional and midnight/date rollover offsets',()=>{
 for(const [zone,date,expected] of [
 ['UTC','2026-10-16','GMT'],['America/New_York','2026-07-01','GMT-4'],
 ['America/New_York','2026-01-01','GMT-5'],['Asia/Kolkata','2026-10-16','GMT+5:30'],
 ['Asia/Kathmandu','2026-10-16','GMT+5:45'],['America/St_Johns','2026-01-01','GMT-3:30'],
 ['Pacific/Auckland','2026-07-01','GMT+12'],['Pacific/Chatham','2026-10-16','GMT+13:45']])
 assert.equal(formatTimezoneOffset(zone,date),expected,zone);
});
test('invalid drafts have no misleading offset',()=>{
 assert.equal(formatTimezoneOffset('Not/A_Zone','2026-10-16'),'');
 assert.equal(formatTimezoneOffset('Europe/Madrid','not-a-date'),'');
});
