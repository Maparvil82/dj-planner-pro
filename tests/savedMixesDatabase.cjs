const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs'),
    assert = require('node:assert/strict');
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
async function role(n) {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id(n),
    ]);
    await db.exec('set role authenticated');
}
(async () => {
    await db.exec(`create role anon;create role authenticated;create schema auth;grant usage on schema auth to authenticated;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table public.community_profiles(user_id uuid primary key references auth.users(id),artist_name text,avatar_url text,is_visible boolean);
create table public.community_profile_mixes(id uuid primary key,user_id uuid references public.community_profiles(user_id),title text,source_url text,platform text,created_at timestamptz default now());
alter table public.community_profiles enable row level security;alter table public.community_profile_mixes enable row level security;
create policy profile_read on public.community_profiles for select to authenticated using(user_id=(select auth.uid()) or is_visible);
create policy mix_read on public.community_profile_mixes for select to authenticated using(user_id=(select auth.uid()) or exists(select 1 from public.community_profiles p where p.user_id=community_profile_mixes.user_id and p.is_visible));
grant select on public.community_profiles,public.community_profile_mixes to authenticated;`);
    await db.query('insert into auth.users values($1),($2),($3)', [
        id(1),
        id(2),
        id(3),
    ]);
    await db.query(
        "insert into public.community_profiles values($1,'Viewer',null,true),($2,'Artist',null,true),($3,'Private',null,false)",
        [id(1), id(2), id(3)],
    );
    await db.query(
        "insert into public.community_profile_mixes(id,user_id,title,source_url,platform) values($1,$2,'Soul mix','https://www.mixcloud.com/artist/soul/','mixcloud'),($3,$4,'Private mix','https://soundcloud.com/private/mix','soundcloud')",
        [id(11), id(2), id(12), id(3)],
    );
    await db.exec(
        fs.readFileSync(
            'supabase/migrations/20261005222245_private_saved_mixes.sql',
            'utf8',
        ),
    );
    await role(1);
    await db.query(
        'insert into public.saved_mixes(owner_id,mix_id) values($1,$2)',
        [id(1), id(11)],
    );
    await assert.rejects(
        () =>
            db.query(
                'insert into public.saved_mixes(owner_id,mix_id) values($1,$2)',
                [id(2), id(11)],
            ),
        /row-level security/,
    );
    await assert.rejects(
        () =>
            db.query(
                'insert into public.saved_mixes(owner_id,mix_id) values($1,$2)',
                [id(1), id(12)],
            ),
        /row-level security/,
    );
    await assert.rejects(
        () =>
            db.query(
                'insert into public.saved_mixes(owner_id,mix_id) values($1,$2)',
                [id(1), id(11)],
            ),
        /unique/,
    );
    await assert.rejects(
        () => db.query('update public.saved_mixes set owner_id=$1', [id(2)]),
        /permission denied/,
    );
    let rows = (await db.query('select * from public.saved_mix_list(0,20)'))
        .rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].artist_name, 'Artist');
    assert.equal(rows[0].title, 'Soul mix');
    assert.equal(rows[0].owner_id, undefined);
    assert.equal(
        (await db.query('select * from public.saved_mix_list(1,20)')).rows
            .length,
        0,
    );
    await role(2);
    assert.equal(
        (await db.query('select * from public.saved_mixes')).rows.length,
        0,
    );
    assert.equal(
        (await db.query('select * from public.saved_mix_list()')).rows.length,
        0,
    );
    await db.query('delete from public.saved_mixes where owner_id=$1', [id(1)]);
    await role(1);
    assert.equal(
        (await db.query('select * from public.saved_mixes')).rows.length,
        1,
    );
    await db.exec('reset role');
    await db.query(
        'update public.community_profiles set is_visible=false where user_id=$1',
        [id(2)],
    );
    await role(1);
    assert.equal(
        (await db.query('select * from public.saved_mix_list()')).rows.length,
        0,
        'A bookmark cannot bypass author privacy',
    );
    await db.exec('reset role');
    await db.query(
        'update public.community_profiles set is_visible=true where user_id=$1',
        [id(2)],
    );
    await db.query(
        "update public.community_profile_mixes set title='New title' where id=$1",
        [id(11)],
    );
    await role(1);
    assert.equal(
        (await db.query('select * from public.saved_mix_list()')).rows[0].title,
        'New title',
    );
    await db.query(
        'delete from public.saved_mixes where owner_id=$1 and mix_id=$2',
        [id(1), id(11)],
    );
    assert.equal(
        (await db.query('select * from public.saved_mix_list()')).rows.length,
        0,
    );
    await db.query(
        'insert into public.saved_mixes(owner_id,mix_id) values($1,$2)',
        [id(1), id(11)],
    );
    await db.exec('reset role');
    await db.query('delete from public.community_profile_mixes where id=$1', [
        id(11),
    ]);
    assert.equal(
        (await db.query('select count(*)::int n from public.saved_mixes'))
            .rows[0].n,
        0,
    );
    await db.exec('set role anon');
    await assert.rejects(
        () => db.query('select * from public.saved_mix_list()'),
        /permission denied/,
    );
    await assert.rejects(
        () => db.query('select * from public.saved_mixes'),
        /permission denied/,
    );
    console.log(
        'PASS: private bookmarks, accessible mixes only, duplicates, ownership, no reassignment, live titles, pagination, hidden profiles, deletion and anonymous denial',
    );
    await db.close();
})().catch(async (e) => {
    console.error(e);
    await db.close();
    process.exitCode = 1;
});
