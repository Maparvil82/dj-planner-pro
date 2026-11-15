const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
function load(file,imports){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(name=>{if(!(name in imports))throw Error(name);return imports[name];},m,m.exports);return m.exports;}
const model=load('src/utils/sessionTemplates.ts',{'../types/session':{SESSION_EVENT_TYPES:['club','festival','wedding','corporate','residency']}});
const original={id:'old',user_id:'a',date:'2026-01-01',title:'Private event',venue:'Zoco',venue_id:'venue-1',start_time:'23:00:00',end_time:'04:00:00',event_type:'club',earning_type:'fixed',earning_amount:250,currency:'EUR',color:'#34d399',booking_timezone:'Europe/Madrid',notes:'Private note',amount_paid:100,poster_url:'private',djs:['Other DJ'],recurrence_type:'weekly',fee_agreement:{private:true}};
function fixture(){const store=new Map();let id=0,fail=false;const api=load('src/services/sessionTemplates.ts',{
 '@react-native-async-storage/async-storage':{getItem:async key=>store.get(key)||null,setItem:async(key,value)=>{if(fail)throw Error('disk full');store.set(key,value);}},
 'expo-crypto':{randomUUID:()=>String(++id)},'../utils/sessionTemplates':model,
}).sessionTemplates;return {api,store,setFail:value=>{fail=value;}};}
test('only reusable fields are copied; no dates, payments, private notes, collaborators or recurrence',()=>{
 const fields=model.sessionTemplateFields(original);
 assert.equal(fields.start_time,'23:00');assert.equal(fields.earning_amount,250);
 for(const key of ['id','user_id','date','title','notes','amount_paid','poster_url','djs','recurrence_type','fee_agreement'])assert.equal(key in fields,false,key);
 assert.equal(model.validTemplate({id:'1',name:'Zoco',fields}),true);
 assert.throws(()=>model.sessionTemplateFields({...original,earning_type:'agreement'}),/agreementUnsupported/);
});
test('templates persist per account; rename and delete do not change source session or other accounts',async()=>{
 const f=fixture();const before=JSON.stringify(original);
 const [row]=await f.api.save('a','  Zoco habitual  ',original);
 assert.equal((await f.api.list('a'))[0].name,'Zoco habitual');assert.deepEqual(await f.api.list('b'),[]);
 await f.api.rename('a',row.id,'Viernes');assert.equal((await f.api.list('a'))[0].name,'Viernes');
 await f.api.remove('b',row.id);assert.equal((await f.api.list('a')).length,1);
 await f.api.remove('a',row.id);assert.deepEqual(await f.api.list('a'),[]);assert.equal(JSON.stringify(original),before);
 await assert.rejects(f.api.save('b','Foreign',original),/storageError/);
 await assert.rejects(f.api.save('a','Guest',{...original,is_guest:true}),/storageError/);
});
test('simultaneous writes are serialized and duplicate or blank names cannot overwrite a template',async()=>{
 const f=fixture();await Promise.all([f.api.save('a','One',original),f.api.save('a','Two',original)]);
 assert.equal((await f.api.list('a')).length,2);
 await assert.rejects(f.api.save('a','one',original),/duplicateName/);await assert.rejects(f.api.save('a',' ',original),/invalidName/);
 const rows=await f.api.list('a');await assert.rejects(f.api.rename('a',rows[0].id,'Two'),/duplicateName/);
 assert.equal((await f.api.list('a')).length,2);
});
test('storage failure and corrupt data are surfaced without replacing existing templates',async()=>{
 const f=fixture();await f.api.save('a','Original',original);f.setFail(true);
 await assert.rejects(f.api.save('a','Failed',original),/disk full/);f.setFail(false);
 assert.equal((await f.api.list('a')).length,1);
 f.store.set('djplanner-session-templates-v1:a','broken json');await assert.rejects(f.api.save('a','New',original));
 assert.equal(f.store.get('djplanner-session-templates-v1:a'),'broken json');
});
