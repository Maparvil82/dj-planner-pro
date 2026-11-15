const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs');
async function doorDb(){
 const db=new PGlite();
 await db.exec(fs.readFileSync('tests/fixtures/bookingBase.sql','utf8'));
 await db.exec("alter table public.sessions add column booking_timezone text default 'UTC'");
 for(const file of ['20261008184444_event_ticket_access.sql','20261008212855_guest_lists.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
 await db.exec(`create schema account_private; create table account_private.blocked(user_id uuid);
 create function account_private.active_user(target uuid) returns boolean language sql as $$select exists(select 1 from auth.users where id=target) and not exists(select 1 from account_private.blocked where user_id=target)$$;
 create function account_private.write_guard() returns trigger language plpgsql as $$begin return new; end$$;`);
 for(const file of ['20261010193744_external_entry_counter.sql','20261010204531_manual_entry_counter.sql','20261011094236_door_access.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
 return db;
}
module.exports={doorDb};
