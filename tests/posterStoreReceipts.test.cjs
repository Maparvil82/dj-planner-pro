const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const ts=require('typescript');
const mod={exports:{}};new Function('module','exports',ts.transpileModule(fs.readFileSync('supabase/functions/poster-ai/store.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(mod,mod.exports);
const {sandboxReceipts,POSTER_PRODUCTS}=mod.exports;
test('only verified Apple sandbox receipts from known products are eligible',()=>{
 const product=POSTER_PRODUCTS[0];const t={id:'receipt-1',store:'app_store',is_sandbox:true};const info=entries=>({subscriber:{non_subscriptions:{[product]:entries,'unknown':[t]}}});
 assert.deepEqual(sandboxReceipts(info([t])),[{receipt:'receipt-1',product}]);
 assert.deepEqual(sandboxReceipts(info([{...t,is_sandbox:false},{...t,store:'play_store'},{...t,refunded_at:'today'}])),[]);
 assert.throws(()=>sandboxReceipts({}));assert.throws(()=>sandboxReceipts(info([{...t,id:''}])));
});
test('sandbox receipt grant is idempotent, rejects foreign owners and cannot be invoked by clients',async()=>{
 const {PGlite}=require('@electric-sql/pglite');const db=new PGlite();const owner='d5d17646-f273-4fda-b094-ea8a97cb3ad1';
 try{await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${owner}');create table public.poster_test_wallets(user_id uuid primary key,units integer default 0,reserved_units integer default 0);`);
 await db.exec(fs.readFileSync('supabase/migrations/20261021122711_poster_apple_sandbox_receipts.sql','utf8'));
 const grant=(receipt,product=POSTER_PRODUCTS[0],user=owner)=>db.query('select public.poster_grant_sandbox_receipt($1,$2,$3)',[user,receipt,product]);
 await grant('one');await grant('one');assert.equal((await db.query('select units from public.poster_test_wallets')).rows[0].units,10);
 await assert.rejects(grant('one',POSTER_PRODUCTS[1]),/poster_id_conflict/);await assert.rejects(grant('bad','unknown'),/poster_invalid_input/);await assert.rejects(grant('other',POSTER_PRODUCTS[0],'12345678-1234-4234-8234-123456789012'),/poster_forbidden/);
 await db.exec('set role authenticated');await assert.rejects(grant('two'),/permission denied/);
 }finally{await db.close();}
});
