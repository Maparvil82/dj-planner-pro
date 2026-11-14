const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm'), ts=require('typescript');
function fixture(rpc){ const mod={exports:{}}; vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/services/collaborations.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,require:()=>({supabase:{rpc}})});return mod.exports.collaborationService; }
test('guest agenda sends date bounds before pagination and retains every accepted row',async()=>{
 const calls=[];const service=fixture(async(name,args)=>{calls.push({name,args});return {data:args.page_offset===0 ? Array.from({length:1000},(_,i)=>({id:String(i)})) : [{id:'last'}],error:null};});
 const rows=await service.agenda({from:'2027-01-01',to:'2027-02-01'});
 assert.equal(rows.length,1001);assert.deepEqual(calls.map(c=>c.args.page_offset),[0,1000]);assert(calls.every(c=>c.name==='session_agenda_range'&&c.args.from_date==='2027-01-01'&&c.args.to_date==='2027-02-01'));
});
test('old backend compatibility filters accepted invitations and period; permission errors never fall back',async()=>{
 const service=fixture(async name=>name==='session_agenda_range' ? {data:null,error:{code:'PGRST202',message:'missing'}} : {error:null,data:[
 {status:'accepted',session:{id:'in',date:'2027-01-15'}},{status:'accepted',session:{id:'past',date:'2026-01-15'}},{status:'invited',session:{id:'waiting',date:'2027-01-20'}}]});
 const rows=await service.agenda({from:'2027-01-01',to:'2027-02-01'});assert.deepEqual(Array.from(rows,r=>r.id),['in']);
 const denied=fixture(async()=>({error:{code:'42501',message:'denied'}}));await assert.rejects(denied.agenda(),/denied/);
});
