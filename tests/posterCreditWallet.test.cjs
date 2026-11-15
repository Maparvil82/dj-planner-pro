const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');
test('test wallet purchase and reservations are atomic, metered in halves and settled once',async()=>{
 const {PGlite}=require('@electric-sql/pglite');const db=new PGlite();const owner='d5d17646-f273-4fda-b094-ea8a97cb3ad1';const job='12345678-1234-4234-8234-123456789012';const edit='12345678-1234-4234-8234-123456789013';
 try{await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema poster_private;create table auth.users(id uuid primary key);insert into auth.users values('${owner}');create table public.poster_ai_jobs(id uuid primary key,user_id uuid,parent_id uuid,status text);`);
 await db.exec(fs.readFileSync('supabase/migrations/20261021013422_poster_test_credit_wallet.sql','utf8'));
 const balance=async()=> (await db.query('select * from public.poster_test_wallets')).rows[0];
 await assert.rejects(db.query(`insert into public.poster_ai_jobs(id,user_id,status) values($1,$2,'running')`,[job,owner]),/poster_credits_empty/);
 await db.query('select public.poster_test_purchase($1,$2,$3)',[owner,job,'starter']);await db.query('select public.poster_test_purchase($1,$2,$3)',[owner,job,'starter']);assert.equal((await balance()).units,10);
 await assert.rejects(db.query('select public.poster_test_purchase($1,$2,$3)',[owner,job,'studio']),/poster_id_conflict/);
 await db.query(`insert into public.poster_ai_jobs(id,user_id,status) values($1,$2,'running')`,[job,owner]);assert.equal((await balance()).reserved_units,2);
 await db.query(`update public.poster_ai_jobs set status='complete' where id=$1`,[job]);await db.query(`update public.poster_ai_jobs set status='complete' where id=$1`,[job]);assert.equal((await balance()).units,8);assert.equal((await balance()).reserved_units,0);
 await db.query(`insert into public.poster_ai_jobs(id,user_id,parent_id,status) values($1,$2,$3,'running')`,[edit,owner,job]);assert.equal((await balance()).reserved_units,1);
 await db.query(`update public.poster_ai_jobs set status='uncertain' where id=$1`,[edit]);assert.equal((await balance()).reserved_units,1);
 await db.query(`update public.poster_ai_jobs set status='failed' where id=$1`,[edit]);assert.equal((await balance()).reserved_units,0);assert.equal((await balance()).units,8);
 const acl=(await db.query("select has_table_privilege('authenticated','public.poster_test_wallets','UPDATE') as allowed")).rows[0];assert.equal(acl.allowed,false);
 }finally{await db.close();}
});
