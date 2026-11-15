const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
async function role(user) {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        user,
    ]);
    await db.exec('set role authenticated');
}
(async () => {
    await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE SCHEMA community_private;
GRANT USAGE ON SCHEMA auth,community_private TO authenticated;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
CREATE FUNCTION community_private.filter_key(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$select lower(btrim(regexp_replace(coalesce(t,''),'\\s+',' ','g')))$$;
CREATE FUNCTION community_private.matches_genre(t text,g text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$select lower(g)=any(regexp_split_to_array(lower(t),'[,·;|]'))$$;
CREATE FUNCTION community_private.city_label(city text,location jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $$select concat_ws(' · ',nullif(city,''),nullif(location->>'region',''),nullif(location->>'country',''))$$;
CREATE TABLE public.users_profile(id uuid primary key,artist_name text);
CREATE TABLE public.community_profiles(user_id uuid primary key,artist_name text,avatar_url text,city text,city_location jsonb,genres text,is_visible boolean,created_at timestamptz default now());
CREATE TABLE public.venues(id uuid primary key default gen_random_uuid(),user_id uuid,name text,city text,address text,notes text,updated_at timestamptz default now());
CREATE TABLE public.sessions(id uuid primary key default gen_random_uuid(),user_id uuid,date date,title text,venue text,venue_id uuid references public.venues(id) on delete set null,start_time text,end_time text,booking_timezone text,color text,is_collective boolean,djs text[],earning_type text,earning_amount numeric,currency text,amount_paid numeric,recurrence_type text,recurrence_end_date date,parent_session_id uuid,poster_url text,dj_profile_ids uuid[],poster_focus_x float8 default .5,poster_focus_y float8 default .5,fee_agreement jsonb,status text,created_at timestamptz default now(),updated_at timestamptz default now());
CREATE TABLE public.community_session_shares(session_id uuid,user_id uuid,created_at timestamptz default now());
CREATE TABLE public.community_follows(follower_id uuid,following_id uuid);
CREATE TABLE public.session_collaborators(session_id uuid,dj_id uuid,inviter_id uuid,status text,created_at timestamptz default now());
CREATE TABLE public.community_profile_mixes(id uuid,user_id uuid,title text,source_url text,platform text,created_at timestamptz default now());
CREATE TABLE public.social_notifications(id uuid default gen_random_uuid(),recipient_id uuid,actor_id uuid,kind text,session_id uuid,actor_name text,session_title text,response text,created_at timestamptz default now());
CREATE TYPE public.community_session_card AS(session_id uuid,author_id uuid,artist_name text,avatar_url text,title text,venue text,city text,date date,start_time text,end_time text,poster_url text,shared_at timestamptz,collaborators jsonb,poster_focus_x float8,poster_focus_y float8);
CREATE FUNCTION community_private.notify_social_activity() RETURNS trigger LANGUAGE plpgsql AS $$begin return new;end$$;
CREATE TRIGGER notify_session_updates AFTER UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION community_private.notify_social_activity();
CREATE FUNCTION public.get_session_usage() RETURNS jsonb LANGUAGE sql AS $$select jsonb_build_object('isPro',true,'count',0)$$;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;CREATE POLICY owner ON public.sessions TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;CREATE POLICY owner ON public.venues TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.sessions,public.venues,public.community_session_shares TO authenticated;
GRANT SELECT ON public.community_profiles,public.session_collaborators TO authenticated;
`);
    await db
        .query(
            "insert into public.users_profile values($1,'Owner'),($2,'Guest');insert into public.community_profiles(user_id,artist_name,city,genres,is_visible) values($1,'Owner','Sevilla','House',true),($2,'Guest','Madrid','House',true)",
            [id(1), id(2)],
        )
        .catch(async () => {
            await db.query(
                "insert into public.users_profile values($1,'Owner'),($2,'Guest')",
                [id(1), id(2)],
            );
            await db.query(
                "insert into public.community_profiles(user_id,artist_name,city,genres,is_visible) values($1,'Owner','Sevilla','House',true),($2,'Guest','Madrid','House',true)",
                [id(1), id(2)],
            );
        });
    await db.query(
        "insert into public.venues values($1,$2,'Club','Madrid','Private street','Private notes',now())",
        [id(101), id(1)],
    );
    await db.query(
        "insert into public.sessions(id,user_id,date,title,venue,venue_id,start_time,end_time,status,earning_amount,currency) values($1,$2,current_date-10,'Past','Club',$3,'22:00','04:00','confirmed',999,'EUR'),($4,$2,current_date+10,'Future','Club',$3,'22:00','04:00','confirmed',999,'EUR')",
        [id(201), id(1), id(101), id(202)],
    );
    const migration = fs.readFileSync(
        'supabase/migrations/20261005194137_session_location_integrity.sql',
        'utf8',
    );
    await db.exec(migration);
    await db.exec(
        fs.readFileSync(
            'supabase/migrations/20261005211300_exclude_own_sessions_from_discovery.sql',
            'utf8',
        ),
    );
    assert.equal(
        (
            await db.query(
                'select venue_city from public.sessions where id=$1',
                [id(201)],
            )
        ).rows[0].venue_city,
        'Madrid',
    );
    await role(id(1));
    await assert.rejects(
        () =>
            db.query(
                "insert into public.venues(user_id,name) values($1,'No city')",
                [id(1)],
            ),
        /cityRequired/,
    );
    await db.query(
        "update public.venues set city='Barcelona',address='New street',name='New Club' where id=$1",
        [id(101)],
    );
    let rows = (
        await db.query(
            'select id,venue,venue_city,venue_address from public.sessions order by id',
        )
    ).rows;
    assert.equal(rows[0].venue_city, 'Madrid');
    assert.equal(rows[0].venue, 'Club');
    assert.equal(rows[1].venue_city, 'Barcelona');
    assert.equal(rows[1].venue, 'New Club');
    await db.exec('reset role');
    await db.query(
        "insert into public.session_collaborators(session_id,dj_id,inviter_id,status) values($1,$2,$3,'accepted')",
        [id(202), id(2), id(1)],
    );
    await role(id(1));
    await db.query(
        "update public.venues set address='Meeting street' where id=$1",
        [id(101)],
    );
    await db.exec('reset role');
    assert.equal(
        (
            await db.query(
                "select count(*)::int n from public.social_notifications where kind='session_update'",
            )
        ).rows[0].n,
        1,
    );
    await role(id(1));
    await db.query("update public.venues set name='NEW CLUB' where id=$1", [
        id(101),
    ]);
    await db.exec('reset role');
    assert.equal(
        (
            await db.query(
                "select count(*)::int n from public.social_notifications where kind='session_update'",
            )
        ).rows[0].n,
        1,
    );
    await role(id(1));
    await role(id(2));
    await assert.rejects(
        () =>
            db.query(
                "insert into public.sessions(user_id,date,venue,venue_id,start_time,end_time) values($1,current_date+1,'Foreign',$2,'22:00','04:00')",
                [id(2), id(101)],
            ),
        /ownerRequired/,
    );
    const invitation = (
        await db.query('select * from community_private.collaboration_inbox(0)')
    ).rows[0].collaboration_inbox;
    assert.equal(invitation.session.venue_city, 'Barcelona');
    assert.equal(invitation.session.venue_address, 'Meeting street');
    assert.equal(invitation.session.earning_amount, 0);
    assert.equal(invitation.session.notes, undefined);
    await role(id(1));
    await db.query(
        'insert into public.community_session_shares(session_id,user_id) values($1,$2)',
        [id(202), id(1)],
    );
    await db.query(
        "insert into public.sessions(id,user_id,date,venue,start_time,end_time,status) values($1,$2,current_date,'Unknown','22:00','04:00','confirmed')",
        [id(203), id(1)],
    );
    await assert.rejects(
        () =>
            db.query(
                'insert into public.community_session_shares(session_id,user_id) values($1,$2)',
                [id(203), id(1)],
            ),
        /completeBeforeSharing/,
    );
    await db.query('update public.venues set archived_at=now() where id=$1', [
        id(101),
    ]);
    await assert.rejects(
        () =>
            db.query(
                "insert into public.sessions(user_id,date,venue,venue_id,start_time,end_time) values($1,current_date+1,'Archived',$2,'22:00','04:00')",
                [id(1), id(101)],
            ),
        /archived/,
    );
    await db.query('delete from public.venues where id=$1', [id(101)]);
    rows = (
        await db.query(
            'select venue_id,venue_city,venue_address from public.sessions where id=$1',
            [id(202)],
        )
    ).rows;
    assert.equal(rows[0].venue_id, null);
    assert.equal(rows[0].venue_city, 'Barcelona');
    assert.equal(rows[0].venue_address, 'Meeting street');
    const publicRows = (
        await db.query(
            "select * from community_private.session_shelf('city','Barcelona',current_date,'','','',0,20)",
        )
    ).rows;
    assert.equal(publicRows.length, 1);
    assert.equal(publicRows[0].city, 'Barcelona');
    assert.equal(publicRows[0].venue_address, undefined);
    assert.equal(publicRows[0].earning_amount, undefined);
    const options = (
        await db.query(
            "select community_private.filter_options('sessions') options",
        )
    ).rows[0].options;
    assert(options.cities.includes('Barcelona'));
    assert.equal(
        (
            await db.query(
                "select community_private.city_matches('Paris','{\"country\":\"France\"}'::jsonb,'Paris · France') yes,community_private.city_matches('Paris','{\"country\":\"USA\"}'::jsonb,'Paris · France') no",
            )
        ).rows[0].no,
        false,
    );
    const time = (
        await db.query(
            "select (community_private.event_instant('2026-10-05','22:00','Europe/Madrid') at time zone 'UTC')::text t",
        )
    ).rows[0].t;
    assert(time.includes('20:00:00'));
    await db.query(
        "insert into public.sessions(id,user_id,date,venue,start_time,end_time,status,venue_city) values($1,$2,current_date-1,'Night','22:00','23:59','confirmed','Barcelona')",
        [id(204), id(1)],
    );
    await db.query(
        'insert into public.community_session_shares(session_id,user_id) values($1,$2)',
        [id(204), id(1)],
    );
    assert.equal(
        (
            await db.query(
                "select count(*)::int n from community_private.session_shelf('city','Barcelona',current_date,'','','',0,20)",
            )
        ).rows[0].n,
        1,
    );
    await assert.rejects(
        () =>
            db.query(
                "insert into public.sessions(user_id,date,start_time,end_time,booking_timezone) values($1,current_date,'22:00','04:00','Invalid/Zone')",
                [id(1)],
            ),
        /invalidTimezone/,
    );
    await db.query(
        "insert into public.venues(id,user_id,name,city) values($1,$2,'Series Club','Lisboa')",
        [id(105), id(1)],
    );
    const seriesInput = {
        date: '2026-12-01',
        venue: 'Series Club',
        venue_id: id(105),
        start_time: '22:00',
        end_time: '04:00',
        booking_timezone: 'Europe/Lisbon',
    };
    const created = (
        await db.query(
            "select * from public.create_session_series($1::jsonb,ARRAY['2026-12-01'::date,'2026-12-08'::date])",
            [JSON.stringify(seriesInput)],
        )
    ).rows[0];
    const seriesRows = (
        await db.query(
            'select venue_city,booking_timezone from public.sessions where id=$1 or parent_session_id=$1',
            [created.id],
        )
    ).rows;
    assert.equal(seriesRows.length, 2);
    assert(
        seriesRows.every(
            (s) =>
                s.venue_city === 'Lisboa' &&
                s.booking_timezone === 'Europe/Lisbon',
        ),
    );
    // Discovery excludes the viewer's own agenda before pagination, not just after rendering.
    await role(id(2));
    await db.query(
        "insert into public.sessions(id,user_id,date,venue,start_time,end_time,status,venue_city) values($1,$2,current_date+20,'Other DJ event','22:00','04:00','confirmed','Sevilla')",
        [id(210), id(2)],
    );
    await db.query(
        'insert into public.community_session_shares(session_id,user_id) values($1,$2)',
        [id(210), id(2)],
    );
    await role(id(1));
    let discovery = (
        await db.query(
            "select * from community_private.session_shelf('rest','',current_date,'','','',0,1)",
        )
    ).rows;
    assert.equal(discovery.length, 1);
    assert.equal(discovery[0].author_id, id(2));
    assert.equal(
        (
            await db.query(
                "select count(*)::int n from community_private.session_shelf('rest','',current_date,'','','',1,20)",
            )
        ).rows[0].n,
        0,
    );
    await db.exec('reset role');
    await db.query(
        "insert into public.session_collaborators(session_id,dj_id,inviter_id,status) values($1,$2,$3,'accepted')",
        [id(210), id(1), id(2)],
    );
    await role(id(1));
    discovery = (
        await db.query(
            "select * from community_private.session_shelf('rest','',current_date,'','','',0,20)",
        )
    ).rows;
    assert.equal(
        discovery.length,
        0,
        'Accepted guest sessions also belong to the viewer',
    );
    await db.exec('reset role;set role anon');
    await assert.rejects(
        () =>
            db.query(
                "select * from community_private.session_shelf('rest','',current_date,'','','',0,20)",
            ),
        /permission denied/,
    );
    console.log(
        'PASS: historical snapshots, future propagation, ownership, missing-city publication, archival/deletion, guest privacy, notifications, public filters and time zones',
    );
    await db.close();
})().catch(async (e) => {
    console.error(e);
    await db.close();
    process.exitCode = 1;
});
