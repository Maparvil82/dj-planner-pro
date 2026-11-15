const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs'),
    assert = require('node:assert/strict');
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
async function role(n, r = 'authenticated') {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        n ? id(n) : '',
    ]);
    await db.exec(`set role ${r}`);
}
(async () => {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create schema community_private; create schema account_private;
create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table storage.buckets(id text primary key,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key,bucket_id text,name text,created_at timestamptz default now(),metadata jsonb);
create table public.users_profile(id uuid,avatar_url text);create table public.community_profiles(user_id uuid,avatar_url text,cover_url text,is_visible boolean);
create table public.sessions(id uuid,poster_url text);create table public.community_session_shares(session_id uuid,user_id uuid);create table public.venues(id uuid,images text[]);create table public.expenses(id uuid,receipt_path text);
create table public.vault_files(id uuid,url text);create table community_private.reports(id uuid default gen_random_uuid(),snapshot jsonb);
grant usage on schema auth,storage to authenticated;grant select,insert,update on storage.objects,public.users_profile,public.community_profiles,public.sessions,public.venues,public.expenses,public.vault_files to authenticated;
insert into auth.users values('${id(1)}'),('${id(2)}');insert into storage.buckets(id,public) values('avatars',true),('sessions',true),('venues',true),('vault',false),('expense-receipts',false);`);
    await db.exec(
        `create function account_private.active_user(uuid) returns boolean language sql as $$select exists(select 1 from auth.users where id=$1)$$; create function community_private.profile_allowed(uuid) returns boolean language sql as $$select true$$; create function community_private.content_allowed(text,uuid) returns boolean language sql as $$select true$$;`,
    );
    await db.exec(
        fs.readFileSync(
            'supabase/migrations/20261009182655_storage_limits_and_cleanup.sql',
            'utf8',
        ),
    );
    let rows = (await db.query('select * from storage.buckets')).rows;
    assert.equal(rows.find((x) => x.id === 'vault').file_size_limit, 10485760);
    assert.equal(rows.find((x) => x.id === 'expense-receipts').public, false);
    const object = async (n, bucket, name, age = '2 days', size = 100) =>
        db.query(
            `insert into storage.objects values($1,$2,$3,now()-$4::interval,$5)`,
            [id(n), bucket, name, age, { size }],
        );
    await object(10, 'avatars', id(1) + '/used.jpg');
    await object(11, 'avatars', id(1) + '/unused.jpg');
    await object(12, 'sessions', id(1) + '/recent.jpg', '1 hour');
    await object(13, 'avatars', id(2) + '/other.jpg');
    await object(14, 'vault', id(1) + '/ambiguous name.pdf');
    await object(15, 'avatars', id(1) + '/evidence.jpg');
    await db.query('insert into users_profile values($1,$2)', [
        id(1),
        'https://test.supabase.co/storage/v1/object/public/avatars/' +
            id(1) +
            '/used.jpg',
    ]);
    await db.query(
        'insert into community_private.reports(snapshot) values($1)',
        [
            {
                url:
                    'https://test.supabase.co/storage/v1/object/public/avatars/' +
                    id(1) +
                    '/evidence.jpg',
            },
        ],
    );
    await role(1);
    await assert.rejects(
        db.query("select public.storage_cleanup_work('claim',$1)", [id(2)]),
    );
    await assert.rejects(
        db.query('select * from storage_private.cleanup_claims'),
    );
    await role(null, 'service_role');
    let page = (
        await db.query(
            "select public.storage_cleanup_work('claim',$1) result",
            [id(1)],
        )
    ).rows[0].result;
    assert.deepEqual(page.objects, [
        { bucket_id: 'avatars', name: id(1) + '/unused.jpg' },
    ]);
    await role(1);
    await assert.rejects(
        db.query('insert into public.users_profile values($1,$2)', [
            id(1),
            'https://test.supabase.co/storage/v1/object/public/avatars/' +
                id(1) +
                '/unused.jpg',
        ]),
        /STORAGE_FILE_EXPIRED/,
    );
    await role(2);
    await assert.rejects(
        db.query('insert into public.users_profile values($1,$2)', [
            id(2),
            'https://test.supabase.co/storage/v1/object/public/avatars/' +
                id(1) +
                '/unused.jpg',
        ]),
        /STORAGE_FILE_EXPIRED/,
    );
    await role(null, 'service_role');
    await db.query("select public.storage_cleanup_work('ack',$1,$2)", [
        id(1),
        page.objects,
    ]);
    assert.equal(
        (
            await db.query(
                "select public.storage_cleanup_work('claim',$1) result",
                [id(1)],
            )
        ).rows[0].result.objects.length,
        0,
    );
    await role(1);
    await assert.rejects(
        object(20, 'avatars', id(2) + '/attack.jpg'),
        /STORAGE_OWNER_REQUIRED/,
    );
    await assert.rejects(
        object(21, 'avatars', id(1) + '/over.jpg', '0 hours', 104857600),
        /STORAGE_QUOTA_EXCEEDED/,
    );
    await object(22, 'avatars', id(1) + '/good.jpg', '0 hours', 1000);
    await db.query('update storage.objects set metadata=$1 where id=$2', [
        { size: 2000 },
        id(22),
    ]);
    assert.equal(
        (
            await db.query('select metadata from storage.objects where id=$1', [
                id(22),
            ])
        ).rows[0].metadata.size,
        2000,
    );
    await db.exec('reset role');
    await db.query(
        'insert into public.community_profiles values($1,$2,null,true)',
        [
            id(2),
            'https://test.supabase.co/storage/v1/object/public/avatars/' +
                id(2) +
                '/other.jpg',
        ],
    );
    await role(1);
    assert.equal(
        (
            await db.query('select storage_private.read_allowed($1,$2) ok', [
                'avatars',
                id(1) + '/used.jpg',
            ])
        ).rows[0].ok,
        true,
    );
    assert.equal(
        (
            await db.query('select storage_private.read_allowed($1,$2) ok', [
                'avatars',
                id(2) + '/other.jpg',
            ])
        ).rows[0].ok,
        true,
    );
    assert.equal(
        (
            await db.query('select storage_private.read_allowed($1,$2) ok', [
                'venues',
                id(2) + '/private.jpg',
            ])
        ).rows[0].ok,
        false,
    );
    await role(null, 'anon');
    await assert.rejects(
        db.query('select storage_private.read_allowed($1,$2)', [
            'avatars',
            id(2) + '/other.jpg',
        ]),
    );
    console.log(
        'PASS: server limits, private receipts/vault, quota and owner enforcement, cleanup restricted to own unused old files, recent/referenced/evidence/ambiguous/other-account files retained, reattachment blocked for any user, idempotent cleanup acknowledgement.',
    );
    await db.close();
})().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
