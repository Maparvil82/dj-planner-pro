const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs'),
    assert = require('node:assert/strict');
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
async function role(user, name = 'authenticated') {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        user,
    ]);
    await db.exec(`set role ${name}`);
}
(async () => {
    await db.exec(`create role anon; create role authenticated; create schema auth; create schema community_private;
 grant usage on schema auth,community_private to authenticated;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table auth.users(id uuid primary key);
 create table public.users_profile(id uuid primary key,artist_name text,avatar_url text,updated_at timestamptz default now());
 alter table public.users_profile enable row level security; grant select,insert,update on public.users_profile to authenticated;
 create policy own_account on public.users_profile to authenticated using(id=auth.uid()) with check(id=auth.uid());
 create table public.community_profiles(user_id uuid primary key references auth.users(id),artist_name text,avatar_url text,city text default '',genres text default '',bio text default '',is_visible boolean default false,cover_url text,mixcloud_url text default '',soundcloud_url text default '',instagram_url text default '',created_at timestamptz default now());
 alter table public.community_profiles enable row level security;grant select,insert,update on public.community_profiles to authenticated;
 create policy community_profiles_read on public.community_profiles for select to authenticated using(user_id=auth.uid() or is_visible);
 create policy community_profiles_insert on public.community_profiles for insert to authenticated with check(user_id=auth.uid());
 create policy community_profiles_update on public.community_profiles for update to authenticated using(user_id=auth.uid());
 create table public.community_follows(follower_id uuid,following_id uuid,primary key(follower_id,following_id));
 alter table public.community_follows enable row level security;grant select,insert,delete on public.community_follows to authenticated;
 create policy community_follows_insert on public.community_follows for insert to authenticated with check(follower_id=auth.uid());
 create policy community_follows_read on public.community_follows for select to authenticated using(follower_id=auth.uid());
 create policy community_follows_delete on public.community_follows for delete to authenticated using(follower_id=auth.uid());
 create table public.sessions(id uuid primary key,user_id uuid,status text); grant select on public.sessions to authenticated;
 create table public.community_session_shares(session_id uuid,user_id uuid);
 alter table public.community_session_shares enable row level security;grant insert on public.community_session_shares to authenticated;
 create policy community_shares_insert on public.community_session_shares for insert to authenticated with check(user_id=auth.uid());`);
    // The account-to-community identity trigger is also exercised during transactional saves.
    const identity = fs.readFileSync(
        'supabase/migrations/20261002123415_unify_dj_profile.sql',
        'utf8',
    );
    await db.exec(
        identity.slice(
            identity.indexOf(
                'create function community_private.sync_profile_identity',
            ),
            identity.indexOf('-- Direct social writes'),
        ),
    );
    await db.exec(
        fs.readFileSync(
            'supabase/migrations/20261004112730_community_profile_completion_and_mixes.sql',
            'utf8',
        ),
    );
    await db.exec(
        `create trigger normalize_profile_genres before insert or update of genres on public.community_profiles for each row execute function community_private.normalize_profile_genres();`,
    );
    for (let n = 1; n <= 4; n++) {
        await db.query('insert into auth.users values($1)', [id(n)]);
        await db.query(
            'insert into public.users_profile(id,artist_name,avatar_url) values($1,$2,$3)',
            [
                id(n),
                `DJ ${n}`,
                n === 1 ? null : 'https://example.com/photo.jpg',
            ],
        );
        await db.query(
            'insert into public.community_profiles(user_id,artist_name,avatar_url,city,genres,is_visible) values($1,$2,$3,$4,$5,$6)',
            [
                id(n),
                `DJ ${n}`,
                n === 1 ? null : 'https://example.com/photo.jpg',
                n === 1 ? '' : 'Madrid',
                n === 1 ? '' : 'Jazz',
                n !== 3,
            ],
        );
    }
    await db.query('insert into sessions values($1,$2,$3)', [
        id(90),
        id(1),
        'confirmed',
    ]);
    await role(id(1));
    await assert.rejects(
        db.query('insert into community_session_shares values($1,$2)', [
            id(90),
            id(1),
        ]),
        (e) => e.code === '42501',
    );
    await assert.rejects(
        db.query('insert into public.community_follows values($1,$2)', [
            id(1),
            id(2),
        ]),
        (e) => e.code === '42501',
    );
    await assert.rejects(
        db.query(
            'insert into public.community_profile_mixes(user_id,title,platform,source_url) values($1,$2,$3,$4)',
            [id(1), 'Draft', 'mixcloud', 'https://www.mixcloud.com/dj/test/'],
        ),
        (e) => e.code === '42501',
    );
    const save = (input) =>
        db.query('select public.save_unified_profile($1::jsonb)', [
            JSON.stringify(input),
        ]);
    const draft = {
        artist_name: 'Draft DJ',
        city: '',
        genres: '',
        avatar_url: null,
        is_visible: false,
    };
    await save(draft);
    await assert.rejects(
        save({ ...draft, is_visible: true }),
        (e) => e.code === '22023',
    );
    assert.equal(
        (
            await db.query(
                'select is_visible from community_profiles where user_id=$1',
                [id(1)],
            )
        ).rows[0].is_visible,
        false,
    );
    await save({
        ...draft,
        city: 'Madrid',
        genres: 'jazz · JAZZ · house',
        avatar_url: 'https://example.com/a.jpg',
        is_visible: true,
    });
    assert.equal(
        (
            await db.query(
                'select genres from community_profiles where user_id=$1',
                [id(1)],
            )
        ).rows[0].genres,
        'Jazz · House',
    );
    await db.query('insert into public.community_follows values($1,$2)', [
        id(1),
        id(2),
    ]);
    const add = (
        owner,
        url = 'https://www.mixcloud.com/dj/mix/',
        platform = 'mixcloud',
    ) =>
        db.query(
            'insert into community_profile_mixes(user_id,title,platform,source_url) values($1,$2,$3,$4) returning id',
            [owner, 'Live in Madrid', platform, url],
        );
    await db.query('insert into community_session_shares values($1,$2)', [
        id(90),
        id(1),
    ]);
    const mix = (await add(id(1))).rows[0].id;
    await assert.rejects(add(id(1)), (e) => e.code === '23505');
    await assert.rejects(
        add(id(1), 'https://evil.test/a/b/'),
        (e) => e.code === '23514',
    );
    await assert.rejects(
        add(id(1), 'https://www.mixcloud.com/genres/house/'),
        (e) => e.code === '23514',
    );
    await assert.rejects(
        add(id(2), 'https://www.mixcloud.com/dj/foreign/'),
        (e) => e.code === '42501',
    );
    await db.query('update community_profile_mixes set title=$1 where id=$2', [
        'Renamed',
        mix,
    ]);
    await assert.rejects(
        db.query('update community_profile_mixes set user_id=$1 where id=$2', [
            id(2),
            mix,
        ]),
        (e) => e.code === '42501',
    );
    // A complete private profile can curate mixes, which stay private.
    await role(id(3));
    await add(id(3), 'https://soundcloud.com/dj/private-mix', 'soundcloud');
    assert.equal(
        (
            await db.query(
                'select * from community_profile_mixes where user_id=$1',
                [id(3)],
            )
        ).rows.length,
        1,
    );
    await role(id(2));
    assert.equal(
        (await db.query('select * from community_profile_mixes')).rows.length,
        1,
    );
    assert.equal(
        (
            await db.query(
                'update community_profile_mixes set title=$1 where id=$2 returning id',
                ['Hacked', mix],
            )
        ).rows.length,
        0,
    );
    assert.equal(
        (
            await db.query(
                'delete from community_profile_mixes where id=$1 returning id',
                [mix],
            )
        ).rows.length,
        0,
    );
    await role(id(1));
    await save({
        ...draft,
        avatar_url: 'https://example.com/a.jpg',
        city: 'Madrid',
        genres: 'Jazz',
        is_visible: false,
    });
    await role(id(2));
    assert.equal(
        (await db.query('select * from community_profile_mixes')).rows.length,
        0,
    );
    await role('', 'anon');
    await assert.rejects(
        db.query('select * from community_profile_mixes'),
        (e) => e.code === '42501',
    );
    await role(id(1));
    await db.query('delete from community_profile_mixes where id=$1', [mix]);
    await role(id(1), 'postgres');
    const filters = fs.readFileSync(
        'supabase/migrations/20261004014648_community_city_genre_filters.sql',
        'utf8',
    );
    await db.exec(
        filters.slice(
            0,
            filters.indexOf(
                'create or replace function community_private.session_feed_filtered',
            ),
        ),
    );
    await db.exec(
        'create table public.venues(id uuid,user_id uuid,city text); alter table public.sessions add column venue_id uuid;',
    );
    await db.exec(
        fs.readFileSync(
            'supabase/migrations/20261004131746_hybrid_city_lookup.sql',
            'utf8',
        ),
    );
    const spain = {
        id: 'photon:R:342563',
        name: 'Córdoba',
        region: 'Andalucía',
        country: 'España',
        countryCode: 'ES',
    };
    const argentina = {
        id: 'photon:N:1234',
        name: 'Córdoba',
        region: 'Córdoba',
        country: 'Argentina',
        countryCode: 'AR',
    };
    await role(id(2));
    await save({
        ...draft,
        artist_name: 'DJ 2',
        avatar_url: 'https://example.com/a.jpg',
        city: 'Córdoba',
        genres: 'Jazz',
        is_visible: true,
        city_location: spain,
    });
    await role(id(4));
    await save({
        ...draft,
        artist_name: 'DJ 4',
        avatar_url: 'https://example.com/a.jpg',
        city: 'Córdoba',
        genres: 'Jazz',
        is_visible: true,
        city_location: argentina,
    });
    await role(id(3));
    await save({
        ...draft,
        artist_name: 'DJ 3',
        avatar_url: 'https://example.com/a.jpg',
        city: 'Secret Town',
        genres: 'Jazz',
        is_visible: false,
    });
    await role(id(1));
    assert.equal(
        (await db.query("select * from community_city_suggestions('cordoba')"))
            .rows.length,
        2,
        'Homonymous places retain both identities',
    );
    assert.equal(
        (await db.query("select * from community_city_suggestions('secret')"))
            .rows.length,
        0,
        'Private profile cities are not suggested',
    );
    assert.equal(
        (
            await db.query(
                "select * from community_discover_filtered('', 'Córdoba · Andalucía · España')",
            )
        ).rows.length,
        1,
        'Country-qualified filters distinguish homonyms',
    );
    const opts = (
        await db.query(
            "select community_private.filter_options('djs') as options",
        )
    ).rows[0].options;
    assert.ok(opts.cities.includes('Córdoba · Andalucía · España'));
    assert.ok(opts.cities.includes('Córdoba · Córdoba · Argentina'));
    await role(id(2));
    await save({
        ...draft,
        artist_name: 'DJ 2',
        avatar_url: 'https://example.com/a.jpg',
        city: 'Córdoba',
        genres: 'Jazz',
        is_visible: true,
    });
    assert.equal(
        (
            await db.query(
                'select city_location from community_profiles where user_id=$1',
                [id(2)],
            )
        ).rows[0].city_location.id,
        spain.id,
        'Legacy saves preserve unchanged location',
    );
    await assert.rejects(
        save({
            ...draft,
            artist_name: 'DJ 2',
            avatar_url: 'https://example.com/a.jpg',
            city: 'Madrid',
            genres: 'Jazz',
            is_visible: true,
            city_location: spain,
        }),
        (e) => e.code === '22023',
    );
    await save({
        ...draft,
        artist_name: 'DJ 2',
        avatar_url: 'https://example.com/a.jpg',
        city: 'Madrid',
        genres: 'Jazz',
        is_visible: true,
    });
    assert.equal(
        (
            await db.query(
                'select city_location from community_profiles where user_id=$1',
                [id(2)],
            )
        ).rows[0].city_location,
        null,
        'Changing city clears stale metadata',
    );
    await role('', 'anon');
    await assert.rejects(
        db.query("select * from community_city_suggestions('cordoba')"),
        (e) => e.code === '42501',
    );
    console.log(
        'PASS: profile prerequisites, drafts, Jazz normalization, follow gate, mix ownership/privacy/URL constraints and deletion',
    );
    await db.close();
})().catch(async (e) => {
    console.error(e);
    await db.close();
    process.exitCode = 1;
});
