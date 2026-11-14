const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');
test('poster completion creates one owned notification; updates are idempotent and deletion cleans it',async()=>{
 const {PGlite}=require('@electric-sql/pglite');const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema poster_private;create table public.poster_ai_jobs(id uuid primary key,user_id uuid,session_id uuid,status text,output_path text,form jsonb);create table public.social_notifications(id uuid default gen_random_uuid(),recipient_id uuid,actor_id uuid,kind text constraint social_notifications_kind_check check(kind in ('follow')),session_id uuid,actor_name text,session_title text);`);
 await db.exec(fs.readFileSync('supabase/migrations/20261019234532_poster_ready_notifications.sql','utf8'));
 const id='12345678-1234-4234-8234-123456789012';
 await db.query(`insert into public.poster_ai_jobs values($1,$1,$1,'running',null,'{"title":"Sesión"}')`,[id]);
 assert.equal((await db.query('select * from public.social_notifications')).rows.length,0);
 await db.query(`update public.poster_ai_jobs set status='complete',output_path='private.jpg' where id=$1`,[id]);
 const rows=(await db.query('select * from public.social_notifications')).rows;assert.equal(rows.length,1);assert.equal(rows[0].recipient_id,id);assert.equal(rows[0].poster_job_id,id);assert.equal(rows[0].kind,'poster_ready');
 await db.query(`update public.poster_ai_jobs set status='complete' where id=$1`,[id]);assert.equal((await db.query('select * from public.social_notifications')).rows.length,1);
 await db.query('delete from public.poster_ai_jobs where id=$1',[id]);assert.equal((await db.query('select * from public.social_notifications')).rows.length,0);
 }finally{await db.close();}
});
