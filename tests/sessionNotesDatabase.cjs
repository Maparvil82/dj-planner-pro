const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const db = new PGlite();
const owner = '00000000-0000-4000-8000-000000000991';
const guest = '00000000-0000-4000-8000-000000000992';
async function role(user) {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
    await db.exec('set role authenticated');
}
(async () => {
    // Use the existing session schema fixture, without connecting to a live account.
    const fixture = fs.readFileSync('tests/sessionLocationDatabase.cjs', 'utf8');
    const table = fixture.match(/CREATE TABLE public.sessions\([^\n]+/)[0];
    await db.exec(`create role authenticated; create role anon;
        create schema auth; create schema community_private;
        create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
        grant usage on schema auth to authenticated;
        create table public.venues(id uuid primary key);
        ${table}
        alter table public.sessions add column venue_city text, add column venue_city_location jsonb, add column venue_address text;
        create table public.users_profile(id uuid primary key,artist_name text);
        create table public.session_collaborators(session_id uuid,dj_id uuid,inviter_id uuid,status text,created_at timestamptz default now());
        create function community_private.blocked_between(a uuid,b uuid) returns boolean language sql stable as $$select coalesce(current_setting('test.blocked',true),'false')='true'$$;
        create function public.get_session_usage() returns jsonb language sql stable as $$select jsonb_build_object('isPro',false,'count',(select count(*) from public.sessions),'limit',15)$$;
        alter table public.sessions enable row level security;
        create policy owner on public.sessions to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
        grant select,insert,update on public.sessions to authenticated;`);
    const legacy = (await db.query("insert into sessions(user_id,title) values($1,'Legacy') returning id", [owner])).rows[0].id;
    await db.exec(fs.readFileSync('supabase/migrations/20261015203918_session_event_type.sql', 'utf8'));
    assert.equal((await db.query('select event_type from sessions where id=$1', [legacy])).rows[0].event_type, null);
    // The existing guest projection is privileged; retain its original execution grants.
    await db.exec('revoke all on function community_private.collaboration_inbox(integer) from public,anon; grant usage on schema community_private to authenticated; grant execute on function community_private.collaboration_inbox(integer) to authenticated;');

    await db.exec(fs.readFileSync('supabase/migrations/20261015224211_session_notes.sql','utf8'));
    assert.equal((await db.query('select notes from sessions where id=$1',[legacy])).rows[0].notes,null);
    await role(owner);
    async function create(notes,dates=['2030-01-01']){
        const input={date:dates[0],title:'Notes',venue:'Club',start_time:'22:00',end_time:'04:00',notes};
        return (await db.query('select * from public.create_session_series($1::jsonb,$2::date[])',[JSON.stringify(input),dates])).rows[0];
    }
    const note='Entrada lateral\nPrimer baile: tema acordado 🎵';
    const row=await create('  '+note+'  ',['2030-01-01','2030-01-08']);
    assert.equal(row.notes,note);
    const child=(await db.query('select id,notes from sessions where parent_session_id=$1',[row.id])).rows[0];
    assert.equal(child.notes,note);
    assert.equal((await create(undefined)).notes,null);
    assert.equal((await create(null)).notes,null);
    assert.equal((await create('   ')).notes,null);
    assert.equal((await create('a'.repeat(5000))).notes.length,5000);
    const before=(await db.query('select count(*)::int as n from sessions')).rows[0].n;
    await assert.rejects(()=>create('a'.repeat(5001),['2030-02-01','2030-02-08']),/check constraint/);
    assert.equal((await db.query('select count(*)::int as n from sessions')).rows[0].n,before,'Rejected series stays atomic');
    await db.query('update sessions set notes=$1 where id=$2',['Nueva nota',row.id]);
    assert.equal((await db.query('select notes from sessions where id=$1',[row.id])).rows[0].notes,'Nueva nota');
    assert.equal((await db.query('select notes from sessions where id=$1',[child.id])).rows[0].notes,note,'Editing one occurrence leaves the rest intact');
    await db.query('update sessions set notes=null where id=$1',[row.id]);
    assert.equal((await db.query('select notes from sessions where id=$1',[row.id])).rows[0].notes,null);
    await assert.rejects(()=>db.query('update sessions set notes=$1 where id=$2',['a'.repeat(5001),row.id]),/check constraint/);
    await role(guest);
    assert.equal((await db.query('select notes from sessions where id=$1',[child.id])).rows.length,0);
    assert.equal((await db.query("update sessions set notes='Other' where id=$1 returning id",[child.id])).rows.length,0);
    await db.exec('reset role');
    await db.query("insert into session_collaborators(session_id,dj_id,inviter_id,status) values($1,$2,$3,'accepted')",[child.id,guest,owner]);
    await role(guest);
    const inbox=(await db.query('select community_private.collaboration_inbox(0) as item')).rows;
    assert.equal(inbox.length,1);
    assert.equal('notes' in inbox[0].item.session,false,'Private notes never enter the guest projection');
    await db.exec('reset role; set role anon');
    await assert.rejects(()=>db.query('select notes from sessions'),/permission denied/);
    await role('');await assert.rejects(()=>create('No auth'),/Not authenticated/);
    console.log('PASS: optional notes, paragraphs/Unicode, atomic recurrence, edit/clear, 5000-character server limit, owner isolation and guest privacy.');
    await db.close();
})().catch(async error=>{console.error(error);await db.close();process.exitCode=1;});
