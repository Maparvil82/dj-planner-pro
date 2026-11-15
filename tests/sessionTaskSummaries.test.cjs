const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(rows, failure) {
    const calls=[];
    const filename=path.resolve(__dirname,'../src/services/sessionTools.ts');
    const loaded=new Module(filename,module);
    loaded.require=request=>request==='../lib/supabase'?{supabase:{from:table=>{
        const call={table};calls.push(call);
        const builder={select:columns=>{call.columns=columns;return builder;},eq:(column,value)=>{call.filter=[column,value];return builder;},order:column=>{call.order=column;return builder;},range:async(start,end)=>{call.range=[start,end];return {data:rows.slice(start,end+1),error:failure};}};
        return builder;
    }}}:require(request);
    loaded._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,filename);
    return {service:loaded.exports.sessionTools,calls};
}
test('task summaries span pagination boundaries and request only counts belonging to the user',async()=>{
    const rows=Array.from({length:1005},(_,i)=>({session_id:i<1002?'A':'B',completed:i%2===0}));
    const s=load(rows);const totals=await s.service.taskSummaries('owner');
    assert.deepEqual(totals,{A:{completed:501,pending:501},B:{completed:2,pending:1}});
    assert.deepEqual(s.calls.map(c=>c.range),[[0,999],[1000,1999]]);
    for(const c of s.calls){assert.equal(c.columns,'session_id,completed');assert.deepEqual(c.filter,['user_id','owner']);assert.equal(c.order,'id');}
});
test('empty task lists have no summary badges; failed reads cannot produce partial counts',async()=>{
    assert.deepEqual(await load([]).service.taskSummaries('owner'),{});
    const error=new Error('read failed');await assert.rejects(load([],error).service.taskSummaries('owner'),error);
});
