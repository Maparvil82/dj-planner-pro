const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs'),
    assert = require('node:assert/strict');
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
async function role(user, actor = 'authenticated') {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        user ? id(user) : '',
    ]);
    await db.exec(`set role ${actor}`);
}
async function action(a, input = {}) {
    return (
        await db.query('select public.community_safety($1,$2) result', [
            a,
            JSON.stringify(input),
        ])
    ).rows[0].result;
}
(async () => {
    await db.exec(`create role anon;create role authenticated;create schema auth;create schema community_private;grant usage on schema auth,community_private to authenticated;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table public.community_profiles(user_id uuid primary key,artist_name text,bio text,avatar_url text,cover_url text,is_visible boolean);
create table public.sessions(id uuid primary key,user_id uuid,title text,venue text,status text,date date,poster_url text);
create table public.community_session_shares(session_id uuid primary key,user_id uuid);
create table public.community_profile_mixes(id uuid primary key,user_id uuid,title text,source_url text,platform text);
create table public.community_follows(follower_id uuid,following_id uuid,primary key(follower_id,following_id));
create table public.session_collaborators(session_id uuid,dj_id uuid,inviter_id uuid,status text);
create table public.social_notifications(id uuid default gen_random_uuid(),recipient_id uuid,actor_id uuid);
alter table public.community_profiles enable row level security;alter table public.community_profile_mixes enable row level security;alter table public.community_follows enable row level security;alter table public.social_notifications enable row level security;
grant select,insert,update on public.community_profiles,public.community_profile_mixes,public.community_follows to authenticated;
create policy profiles_read on public.community_profiles for select to authenticated using(is_visible or user_id=auth.uid());
create policy profiles_insert on public.community_profiles for insert to authenticated with check(user_id=auth.uid());
create policy profiles_update on public.community_profiles for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy mixes_read on public.community_profile_mixes for select to authenticated using(user_id=auth.uid() or exists(select 1 from public.community_profiles p where p.user_id=community_profile_mixes.user_id and p.is_visible));
create policy mixes_insert on public.community_profile_mixes for insert to authenticated with check(user_id=auth.uid());
create policy follows_insert on public.community_follows for insert to authenticated with check(follower_id=auth.uid());
create function community_private.session_feed(a boolean,b uuid,c integer,d integer) returns table(session_id uuid,author_id uuid) language sql security definer set search_path='' as $$ select s.id,s.user_id from public.sessions s join public.community_session_shares sh on sh.session_id=s.id join public.community_profiles p on p.user_id=s.user_id and p.is_visible order by s.id limit d offset c; $$;
create function public.community_feed(a boolean,b uuid,c integer,d integer) returns table(session_id uuid,author_id uuid) language sql security invoker set search_path='' as $$select * from community_private.session_feed(a,b,c,d);$$;
grant execute on function community_private.session_feed(boolean,uuid,integer,integer),public.community_feed(boolean,uuid,integer,integer) to authenticated;
insert into auth.users values('${id(1)}'),('${id(2)}'),('${id(3)}'),('${id(4)}');
insert into public.community_profiles values('${id(1)}','Viewer','','https://example.com/1',null,true),('${id(2)}','Other','','https://example.com/2',null,true),('${id(3)}','Third','','https://example.com/3',null,true);
insert into public.sessions values('${id(90)}','${id(2)}','Public','Club','confirmed','2027-01-01'),('${id(91)}','${id(3)}','Public 2','Club','confirmed','2027-01-02'),('${id(92)}','${id(2)}','Private','Club','confirmed','2027-01-03');
insert into public.community_session_shares values('${id(90)}','${id(2)}'),('${id(91)}','${id(3)}');
insert into public.community_profile_mixes values('${id(80)}','${id(2)}','Mix','https://www.mixcloud.com/a/b/','mixcloud');
insert into public.session_collaborators values('${id(90)}','${id(1)}','${id(2)}','accepted'),('${id(91)}','${id(1)}','${id(2)}','invited');
insert into public.community_follows values('${id(1)}','${id(2)}'),('${id(2)}','${id(1)}');`);
    await db.exec(
        fs.readFileSync(
            'supabase/migrations/20261009103647_community_safety.sql',
            'utf8',
        ),
    );
    await role(1);
    assert.equal((await action('status')).accepted, false);
    await assert.rejects(action('accept', { version: 'old' }));
    await assert.rejects(
        db.query(
            'update public.community_profiles set bio=$1 where user_id=$2',
            ['new bio', id(1)],
        ),
    );
    await action('accept', { version: '2026-10-09' });
    await db.query(
        'update public.community_profiles set bio=$1 where user_id=$2',
        ['new bio', id(1)],
    );
    await assert.rejects(
        db.query(
            'update public.community_profiles set bio=$1 where user_id=$2',
            ['child pornography', id(1)],
        ),
    );
    await assert.rejects(action('queue'));
    await assert.rejects(
        action('review', { id: id(20), outcome: 'remove', note: 'test' }),
    );
    await assert.rejects(db.query('select * from community_private.reports'));
    await assert.rejects(
        db.query('insert into community_private.moderators values($1)', [
            id(1),
        ]),
    );
    await assert.rejects(
        action('report', {
            kind: 'session',
            target_id: id(92),
            reason: 'spam',
        }),
    );
    await assert.rejects(
        action('report', { kind: 'profile', target_id: id(1), reason: 'spam' }),
    );
    const report = await action('report', {
        kind: 'session',
        target_id: id(90),
        reason: 'spam',
        details: 'evidence',
    });
    assert.equal(
        (
            await action('report', {
                kind: 'session',
                target_id: id(90),
                reason: 'spam',
            })
        ).id,
        report.id,
    );
    const page = await db.query(
        'select * from public.community_feed(false,null,0,1)',
    );
    assert.equal(
        page.rows[0].session_id,
        id(91),
        'hidden report filtered BEFORE pagination',
    );
    await role(3);
    assert.equal(
        (await db.query('select * from public.community_feed(false,null,0,10)'))
            .rows.length,
        2,
        'report does not globally censor',
    );
    await role(1);
    await action('block', { user_id: id(2) });
    assert.equal((await action('blocked')).length, 1);
    assert.equal(
        (
            await db.query(
                'select * from public.community_profiles where user_id=$1',
                [id(2)],
            )
        ).rows.length,
        0,
    );
    assert.equal(
        (
            await db.query(
                'select * from public.community_profile_mixes where user_id=$1',
                [id(2)],
            )
        ).rows.length,
        0,
    );
    await db.exec('reset role');
    assert.equal(
        (await db.query('select count(*)::int n from public.community_follows'))
            .rows[0].n,
        0,
    );
    assert.equal(
        (
            await db.query(
                'select count(*)::int n from public.session_collaborators',
            )
        ).rows[0].n,
        2,
        'existing agenda and invitations preserved',
    );
    await assert.rejects(
        db.query(
            "update public.session_collaborators set status='accepted' where session_id=$1",
            [id(91)],
        ),
        /COMMUNITY_USER_BLOCKED/,
    );
    await db.query(
        "update public.session_collaborators set status='accepted' where session_id=$1",
        [id(90)],
    );
    await assert.rejects(
        db.query(
            'insert into public.session_collaborators values($1,$2,$3,$4)',
            [id(91), id(1), id(2), 'invited'],
        ),
    );
    await db.query(
        'insert into public.social_notifications(recipient_id,actor_id) values($1,$2)',
        [id(1), id(2)],
    );
    assert.equal(
        (
            await db.query(
                'select count(*)::int n from public.social_notifications',
            )
        ).rows[0].n,
        0,
    );
    await role(2);
    assert.equal(
        (
            await db.query(
                'select * from public.community_profiles where user_id=$1',
                [id(1)],
            )
        ).rows.length,
        0,
        'bilateral block',
    );
    await action('unblock', { user_id: id(1) });
    assert.equal(
        (
            await db.query(
                'select * from public.community_profiles where user_id=$1',
                [id(1)],
            )
        ).rows.length,
        0,
        'cannot lift other persons block',
    );
    await role(1);
    await action('unblock', { user_id: id(2) });
    assert.equal(
        (
            await db.query(
                'select * from public.community_profiles where user_id=$1',
                [id(2)],
            )
        ).rows.length,
        1,
    );
    await db.exec('reset role');
    await db.query('insert into community_private.moderators values($1)', [
        id(4),
    ]);
    await role(4);
    assert.equal((await action('queue')).length, 1);
    await assert.rejects(
        action('review', { id: report.id, note: 'valid note' }),
    );
    await action('review', {
        id: report.id,
        outcome: 'remove',
        note: 'Reviewed spam',
    });
    await role(3);
    assert.equal(
        (await db.query('select * from public.community_feed(false,null,0,10)'))
            .rows.length,
        1,
        'global removal',
    );
    await role(4);
    await action('review', {
        id: report.id,
        outcome: 'suspend',
        note: 'Repeated abusive content',
    });
    await role(2);
    assert.equal((await action('status')).restricted, true);
    await action('accept', { version: '2026-10-09' });
    await assert.rejects(
        db.query(
            'insert into public.community_profile_mixes values($1,$2,$3,$4,$5)',
            [id(81), id(2), 'New', 'https://www.mixcloud.com/a/c/', 'mixcloud'],
        ),
    );
    await role(4);
    await action('review', {
        id: report.id,
        outcome: 'restore',
        note: 'Appeal reviewed',
    });
    await role(3);
    assert.equal(
        (await db.query('select * from public.community_feed(false,null,0,10)'))
            .rows.length,
        2,
    );
    await role(2);
    for (let n = 100; n <= 120; n++)
        await db.query(
            'insert into public.community_profile_mixes values($1,$2,$3,$4,$5)',
            [
                id(n),
                id(2),
                'Mix ' + n,
                'https://www.mixcloud.com/a/m' + n + '/',
                'mixcloud',
            ],
        );
    await role(3);
    for (let n = 100; n < 120; n++)
        await action('report', {
            kind: 'mix',
            target_id: id(n),
            reason: 'spam',
        });
    await assert.rejects(
        action('report', { kind: 'mix', target_id: id(120), reason: 'spam' }),
        /COMMUNITY_REPORT_LIMIT/,
    );
    await db.exec('reset role');
    await db.query('delete from auth.users where id=$1', [id(4)]);
    assert.equal(
        (
            await db.query(
                'select count(*)::int n from community_private.moderators',
            )
        ).rows[0].n,
        0,
        'deleted moderator loses role',
    );
    assert.ok(
        (
            await db.query(
                'select count(*)::int n from community_private.reports',
            )
        ).rows[0].n > 0,
        'reports survive moderator deletion',
    );
    await role(4);
    await assert.rejects(action('queue'), /Authentication required/);
    await db.exec('reset role');
    await db.query('insert into community_private.moderators values($1)', [
        id(3),
    ]);
    await role(3);
    assert.equal(
        (await action('status')).moderator,
        true,
        'manual moderator recovery',
    );
    assert.ok((await action('queue')).length > 0);
    await role(null, 'anon');
    await assert.rejects(action('status'));
    console.log(
        'PASS: consent, content screening, private report evidence, idempotency, private-session protection, bilateral blocks, pre-pagination filtering, accepted agenda preservation, notification suppression, moderator authorization, removal, suspension and restoration.',
    );
    await db.close();
})().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
