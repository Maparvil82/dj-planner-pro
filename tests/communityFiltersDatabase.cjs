const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs'),
    path = require('node:path'),
    assert = require('node:assert/strict');
const db = new PGlite();
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
async function role(name, user = '') {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        user,
    ]);
    await db.exec(`set role ${name}`);
}
const feed = async (
    city = '',
    genre = '',
    follow = false,
    offset = 0,
    size = 20,
) =>
    (
        await db.query(
            'select * from public.community_feed_filtered($1,null,$2,$3,$4,$5)',
            [follow, offset, size, city, genre],
        )
    ).rows;
const discover = async (
    city = '',
    genre = '',
    search = '',
    offset = 0,
    size = 20,
) =>
    (
        await db.query(
            'select * from public.community_discover_filtered($1,$2,$3,$4,$5)',
            [search, city, genre, offset, size],
        )
    ).rows;
(async () => {
    await db.exec(`create role anon;create role authenticated;create schema auth;grant usage on schema auth to authenticated;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create schema community_private;grant usage on schema community_private to authenticated;
 create table public.community_profiles(user_id uuid primary key,artist_name text,city text,genres text,is_visible boolean,created_at timestamptz default now());
 alter table public.community_profiles enable row level security;grant select on public.community_profiles to authenticated;create policy visible on public.community_profiles to authenticated using(is_visible or user_id=auth.uid());
 create table public.sessions(id uuid primary key,user_id uuid,title text,venue text,date date,start_time text,end_time text,status text,poster_url text,venue_id uuid,poster_focus_x float8 default .5,poster_focus_y float8 default .5);
 create table public.venues(id uuid primary key,user_id uuid,city text);
 create table public.community_session_shares(session_id uuid,user_id uuid,created_at timestamptz default now());
 create table public.session_collaborators(session_id uuid,dj_id uuid,status text);
 create table public.community_follows(follower_id uuid,following_id uuid);
 create type public.community_session_card as(session_id uuid,author_id uuid,artist_name text,avatar_url text,title text,venue text,city text,date date,start_time text,end_time text,poster_url text,shared_at timestamptz,collaborators jsonb,poster_focus_x float8,poster_focus_y float8);
 alter table public.community_profiles add column avatar_url text;`);
    await db.exec(
        fs.readFileSync(
            path.join(
                __dirname,
                '../supabase/migrations/20261004014648_community_city_genre_filters.sql',
            ),
            'utf8',
        ),
    );
    for (const [n, name, city, genre, visible] of [
        [1, 'Viewer', 'Sevilla', 'House', true],
        [2, 'Alpha', 'Málaga', 'Deep House', true],
        [3, 'Beta', 'Madrid', 'House · Techno', true],
        [4, 'Hidden', 'Secret City', 'Secret Genre', false],
        [5, 'Pepe', 'Barcelona', 'House', true],
    ])
        await db.query(
            'insert into public.community_profiles(user_id,artist_name,city,genres,is_visible) values($1,$2,$3,$4,$5)',
            [uid(n), name, city, genre, visible],
        );
    await db.query('insert into public.venues values($1,$2,$3),($4,$5,$6)', [
        uid(101),
        uid(2),
        'Málaga',
        uid(102),
        uid(4),
        'Secret City',
    ]);
    async function session(
        n,
        owner = 2,
        status = 'confirmed',
        shared = true,
        venue = 101,
    ) {
        await db.query(
            "insert into public.sessions(id,user_id,title,venue,date,start_time,end_time,status,venue_id) values($1,$2,'Fixture','Club','2027-01-01','22:00','04:00',$3,$4)",
            [uid(n), uid(owner), status, uid(venue)],
        );
        if (shared)
            await db.query(
                'insert into public.community_session_shares values($1,$2,now())',
                [uid(n), uid(owner)],
            );
    }
    await session(201);
    await session(202, 2, 'cancelled');
    await session(203, 2, 'confirmed', false);
    await session(204, 4, 'confirmed', true, 102);
    await session(205);
    await db.query(
        "insert into public.session_collaborators values($1,$2,'accepted'),($3,$4,'pending')",
        [uid(201), uid(5), uid(205), uid(5)],
    );
    await db.query('insert into public.community_follows values($1,$2)', [
        uid(1),
        uid(5),
    ]);
    await role('authenticated', uid(1));
    assert.equal(
        (await feed()).length,
        2,
        'private/cancelled/hidden session leaked',
    );
    assert.equal(
        (await feed(' malaga ', 'deep house')).length,
        2,
        'case/accent normalization failed',
    );
    assert.deepEqual(
        (await feed('Málaga', 'House')).map((s) => s.session_id),
        [uid(201)],
        'House matched Deep House or pending collaborator',
    );
    assert.equal(
        (await feed('Barcelona', 'House')).length,
        0,
        'session city incorrectly used DJ home city',
    );
    assert.equal(
        (await feed('Málaga', 'House', true)).length,
        1,
        'following collaborator filter broken',
    );
    assert.equal(
        (await discover('malaga', 'House')).length,
        0,
        'genre substring matched',
    );
    assert.deepEqual(
        (await discover('madrid', 'house')).map((p) => p.user_id),
        [uid(3)],
    );
    assert.equal(
        (await discover('', '', 'Secret')).length,
        0,
        'hidden DJ leaked',
    );
    assert.equal(
        (await discover('', '', '%')).length,
        0,
        'wildcard search changed scope',
    );
    const options = (
        await db.query(
            "select public.community_filter_options('sessions') result",
        )
    ).rows[0].result;
    assert.deepEqual(options.cities, ['Málaga']);
    assert.ok(!options.genres.includes('Secret Genre'));
    const djOptions = (
        await db.query("select public.community_filter_options('djs') result")
    ).rows[0].result;
    assert.ok(
        djOptions.cities.includes('Madrid') &&
            !djOptions.cities.includes('Secret City'),
    );
    // Matching rows beyond an unfiltered first page must still appear on page 1.
    await role('postgres');
    for (let n = 300; n < 325; n++) await session(n);
    await role('authenticated', uid(1));
    assert.equal(
        (await feed('Málaga', 'House', false, 0, 1))[0].session_id,
        uid(201),
    );
    assert.equal((await feed('Málaga', 'Deep House', false, 20, 20)).length, 7);
    await role('anon');
    await assert.rejects(() => feed(), /permission denied/);
    await assert.rejects(() => discover(), /permission denied/);
    await role('authenticated');
    assert.equal((await feed()).length, 0);
    assert.equal((await discover()).length, 0);
    console.log(
        'PASS combined filters, exact genres, accent/case city matching, accepted collaborators, pagination, name search, private data exclusion and authenticated-only access.',
    );
})()
    .catch((e) => {
        console.error(e);
        process.exitCode = 1;
    })
    .finally(() => db.close());
