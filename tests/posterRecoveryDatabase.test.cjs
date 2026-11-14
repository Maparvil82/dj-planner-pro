const {test}=require('node:test'),assert=require('node:assert/strict'),{PGlite}=require('@electric-sql/pglite');
const {owner,user,other,session,sql}=require('./fixtures/posterRecoveryDb.cjs');
const id=n=>`${String(n).padStart(8,'0')}-1234-4234-8234-123456789012`;
const usage={_provider:'vertex',_model:'gemini-3.1-flash-image',usageMetadata:{promptTokenCount:2644,totalTokenCount:3764,candidatesTokenCount:1120}};
test('interrupted poster jobs recover once, preserve both wallets and fence late workers',async t=>{
 const db=new PGlite();try{
 await db.exec(sql());
 const row=async n=>(await db.query('select * from public.poster_ai_jobs where id=$1',[id(n)])).rows[0];
 const wallet=async()=> (await db.query('select * from public.poster_wallets where user_id=$1',[user])).rows[0];
 const budget=async()=> (await db.query('select * from public.poster_ai_budget')).rows[0];
 const balance=async()=> (await db.query('select public.poster_account_status($1) as s',[user])).rows[0].s;
 const reserve=async(n,target=user)=>{const expected=(await db.query('select poster_url from public.sessions where id=$1',[session])).rows[0].poster_url;return db.query('select public.reserve_session_poster_job($1,$2,$3,null,$4,$5,null,$6) as r',[id(n),target,session,'hash-'+n,{title:'Fixture',format:'Cartel'},expected]);};
 const recover=async(target=user)=>(await db.query('select public.poster_recover_job($1,$2) as r',[target,'https://fixture.invalid'])).rows[0].r;
 const stale=n=>db.query("update public.poster_ai_jobs set created_at=now()-interval '11 minutes' where id=$1",[id(n)]);
 const object=(n,bucket='poster-ai-private',ext='jpg')=>db.query('insert into storage.objects(bucket_id,name) values($1,$2)',[bucket,bucket==='sessions'?`${user}/poster_ai_${id(n)}.jpg`:`${user}/${id(n)}.${ext}`]);
 const settle=(n,status='complete',u=usage,output=`${user}/${id(n)}.jpg`,code=null,noCharge=false)=>db.query('select public.settle_poster_ai_job($1,$2,$3,$4,$5,null,$6)',[id(n),status,u,output,code,noCharge]);
 await t.test('fresh jobs remain reserved; dispatch succeeds exactly once and belongs to its user',async()=>{
  await reserve(1);assert.equal((await balance()).credits,9);assert.equal(await recover(),null);
  assert.equal((await db.query('select public.poster_begin_provider($1,$2) as ok',[id(1),other])).rows[0].ok,false);
  assert.equal((await db.query('select public.poster_begin_provider($1,$2) as ok',[id(1),user])).rows[0].ok,true);
  assert.equal((await db.query('select public.poster_begin_provider($1,$2) as ok',[id(1),user])).rows[0].ok,false);
  await assert.rejects(reserve(2),/poster_busy/);
 });
 await t.test('no output after deadline releases user credit, conservatively accounts operator cost and unblocks',async()=>{
  await stale(1);const before=await budget();assert.equal((await recover()).status,'failed');const after=await budget();
  assert.equal((await row(1)).error_code,'poster_generation_interrupted');assert.equal((await row(1)).provider_cost_estimated,true);
  assert.equal((await balance()).credits,10);assert.equal((await wallet()).reserved_bonus_units,0);assert.equal((await wallet()).paid_units,10);
  assert.equal(after.accounted_eur_cents,before.accounted_eur_cents+75);assert.equal(after.reserved_eur_cents,0);
  assert.equal(await recover(),null);await settle(1);assert.deepEqual(await budget(),after);assert.equal((await row(1)).status,'failed');
  assert.equal((await db.query('select public.reserve_session_poster_job($1,$2,$3,null,$4,$5,null,null) as r',[id(1),user,session,'hash-1',{title:'Fixture',format:'Cartel'}])).rows[0].r.created,false);
  await assert.rejects(object(1),/poster_forbidden/);
 });
 await t.test('an interrupted pre-dispatch attempt is released with no assumed provider cost',async()=>{
  await reserve(2);const before=await budget();await settle(2,'failed',null,null,'poster_not_sent',true);
  assert.equal((await budget()).accounted_eur_cents,before.accounted_eur_cents);assert.equal((await balance()).credits,10);assert.equal((await row(2)).accounted_eur_cents,0);
 });
 await t.test('saved original and session copy recover after lost completion, without overwriting a manual change',async()=>{
  await reserve(3);await object(3);await object(3,'sessions');await stale(3);
  await db.query('update public.poster_ai_jobs set usage=$2 where id=$1',[id(3),usage]);await db.exec("update public.sessions set poster_url='https://fixture.invalid/manual.jpg'");
  const before=await budget();const result=await recover();assert.equal(result.status,'complete');assert.equal(result.session_poster_applied,false);assert.equal((await balance()).credits,9);
  assert.match(result.output_path,/\.jpg$/);assert.match(result.session_poster_url,/storage\/v1\/object\/public\/sessions/);
  assert.equal((await db.query('select poster_url from public.sessions')).rows[0].poster_url,'https://fixture.invalid/manual.jpg');
  const after=await budget();assert.equal(after.accounted_eur_cents,before.accounted_eur_cents+9);assert.equal(after.reserved_eur_cents,0);assert.equal(result.provider_cost_estimated,false);
  await settle(3);assert.deepEqual(await budget(),after);assert.equal((await balance()).credits,9);
 });
 await t.test('an uncertain original is immediately rescued even without a session copy; settlement is not charged again',async()=>{
  await reserve(4);await object(4,'poster-ai-private','png');await settle(4,'uncertain',usage,null,'poster_provider_uncertain');const before=await budget();
  const result=await recover();assert.equal(result.status,'complete');assert.match(result.output_path,/\.png$/);assert.equal(result.session_poster_applied,false);assert.deepEqual(await budget(),before);
  assert.equal((await row(4)).credit_state,'consumed');assert.equal((await balance()).credits,8);
 });
 await t.test('known usage on an uncertain missing result is not re-accounted when its user gets the credit back',async()=>{
  await reserve(5);await settle(5,'uncertain',usage,null,'poster_provider_uncertain');const before=await budget();assert.equal(await recover(),null);await stale(5);await recover();
  assert.deepEqual(await budget(),before);assert.equal((await balance()).credits,8);assert.equal((await row(5)).credit_state,'released');
 });
 await t.test('unknown cost stays reserved until recovery; batch watchdog finishes without a client',async()=>{
  await reserve(6);await settle(6,'uncertain',null,null,'poster_provider_uncertain');assert.equal((await budget()).reserved_eur_cents,75);await stale(6);
  assert.equal((await db.query('select poster_private.recover_stale_jobs() as n')).rows[0].n,1);assert.equal((await row(6)).status,'failed');assert.equal((await budget()).reserved_eur_cents,0);
  assert.equal((await db.query('select poster_private.recover_stale_jobs() as n')).rows[0].n,0);
 });
 await t.test('an unmodified session receives its recovered copy atomically',async()=>{
  await reserve(7);await object(7);await object(7,'sessions');await stale(7);const result=await recover();assert.equal(result.session_poster_applied,true);
  assert.equal((await db.query('select poster_url from public.sessions')).rows[0].poster_url,result.session_poster_url);
 });
 await t.test('dispatch after the deadline is denied before contacting the provider',async()=>{
  await reserve(8);await stale(8);assert.equal((await db.query('select public.poster_begin_provider($1,$2) as ok',[id(8),user])).rows[0].ok,false);await recover();
 });
 await t.test('a saved output with unknown usage is delivered but uses a conservative operator estimate',async()=>{
  await reserve(9);await object(9);await stale(9);const before=await budget();const result=await recover();assert.equal(result.status,'complete');assert.equal(result.provider_cost_estimated,true);assert.equal((await budget()).accounted_eur_cents,before.accounted_eur_cents+75);
 });
 await t.test('simulation recovery releases only simulation credit and keeps paid balances unchanged',async()=>{
  await db.exec('reset role');await db.query('update public.sessions set user_id=$1 where id=$2',[owner,session]);await db.exec('set role service_role');
  const paid=await wallet();await reserve(10,owner);await stale(10);await recover(owner);assert.equal((await row(10)).test_credit_state,'released');assert.deepEqual(await wallet(),paid);
  assert.deepEqual((await db.query('select units,reserved_units from public.poster_test_wallets where user_id=$1',[owner])).rows[0],{units:20,reserved_units:0});
 });
 await t.test('client roles cannot dispatch, recover, settle or run the watchdog',async()=>{
  for(const role of ['anon','authenticated']){await db.exec('reset role;set role '+role);await assert.rejects(recover(),/permission denied/);await assert.rejects(settle(1),/permission denied/);await assert.rejects(db.query('select public.poster_begin_provider($1,$2)',[id(1),user]),/permission denied/);await assert.rejects(db.query('select poster_private.recover_stale_jobs()'),/permission denied/);}
 });
 }finally{await db.close();}
});
