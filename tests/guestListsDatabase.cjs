const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs'),
    path = require('node:path'),
    assert = require('node:assert/strict');
const db = new PGlite(),
    owner = '00000000-0000-4000-8000-000000000881',
    other = '00000000-0000-4000-8000-000000000882';
async function role(name, uid = '') {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        uid,
    ]);
    await db.exec(`set role ${name}`);
}
async function query(sql, args = []) {
    return (await db.query(sql, args)).rows;
}
const save = (session, id, name, companions = 0, revision = 0) =>
    query('select * from public.save_event_guest($1,$2,$3,$4,$5)', [
        session,
        id,
        name,
        companions,
        revision,
    ]).then((r) => r[0]);
const access = (
    session,
    id,
    action = 'admit',
    count = 1,
    request = crypto.randomUUID(),
) =>
    query('select public.register_guest_access($1,$2,$3,$4,$5)', [
        session,
        id,
        action,
        count,
        request,
    ]);
const list = (session) =>
    query('select public.event_guest_list($1) as data', [session]).then(
        (r) => r[0].data,
    );
const summary = (session) =>
    query('select public.event_ticket_summary($1) as data', [session]).then(
        (r) => r[0].data,
    );
const remove = (session, id) =>
    query('select public.remove_event_guest($1,$2)', [session, id]);
(async () => {
    for (const file of [
        'fixtures/bookingBase.sql',
        '../supabase/migrations/20261008184444_event_ticket_access.sql',
        '../supabase/migrations/20261008212855_guest_lists.sql',
        '../supabase/migrations/20261008213917_guest_list_currency_guard.sql',
    ])
        await db.exec(fs.readFileSync(path.join(__dirname, file), 'utf8'));
    await db.query('insert into auth.users values($1),($2)', [owner, other]);
    await role('authenticated', owner);
    const a = (
        await query(
            "insert into public.sessions(user_id,date,title,venue) values($1,'2026-10-10','A','Club') returning id",
            [owner],
        )
    )[0].id;
    const b = (
        await query(
            "insert into public.sessions(user_id,date,title,venue) values($1,'2026-10-11','B','Club') returning id",
            [owner],
        )
    )[0].id;
    const id = crypto.randomUUID();
    let g = await save(a, id, 'Manuel Parra', 3);
    assert.equal((await list(a))[0].total, 4);
    assert.equal((await summary(a)).invited, 4);
    await query("update public.sessions set currency='USD' where id=$1", [a]);
    await save(a, id, 'Manuel Parra', 3);
    assert.equal(
        (await summary(a)).issued,
        4,
        'Lost response retry must not issue twice',
    );
    for (const args of [
        [a, crypto.randomUUID(), 'X', 0],
        [a, crypto.randomUUID(), 'Valid', -1],
        [a, crypto.randomUUID(), 'Valid', 100],
    ])
        await assert.rejects(() => save(...args), /guests.invalid/);
    const operation = crypto.randomUUID();
    await access(a, id, 'admit', 2, operation);
    await access(a, id, 'admit', 2, operation);
    assert.equal((await list(a))[0].admitted, 2);
    assert.equal((await summary(a)).accepted, 2);
    await assert.rejects(
        () => access(a, id, 'admit', 1, operation),
        /guests.invalid/,
    );
    await assert.rejects(() => access(a, id, 'admit', 3), /guests.changed/);
    await assert.rejects(
        () => save(a, id, 'Manuel Parra', 0, g.revision),
        /guests.belowAdmitted/,
    );
    await assert.rejects(() => remove(a, id), /guests.cannotRemove/);
    await access(a, id, 'undo', 1);
    assert.equal((await list(a))[0].admitted, 1);
    const stale = g.revision;
    g = await save(a, id, 'Manuel Parra', 1, g.revision);
    assert.equal((await list(a))[0].total, 2);
    await assert.rejects(
        () => save(a, id, 'Changed', 2, stale),
        /guests.changed/,
    );
    const token = (
        await query(
            "select token from public.event_tickets where guest_id=$1 and state='issued'",
            [id],
        )
    )[0].token;
    await query('select public.check_in_event_ticket($1,$2)', [a, token]);
    assert.equal(
        (await list(a))[0].admitted,
        2,
        'QR and guest list share the same admissions',
    );
    await query('select public.check_in_event_ticket($1,$2)', [a, token]);
    assert.equal((await summary(a)).accepted, 2);
    await assert.rejects(() => access(a, id, 'admit', 1), /guests.changed/);
    g = await save(a, id, 'Manuel Parra', 3, g.revision);
    assert.equal((await list(a))[0].total, 4);
    assert.equal((await list(a))[0].admitted, 2);
    const usedTicket = (
        await query(
            "select id from public.event_tickets where guest_id=$1 and state='used'",
            [id],
        )
    )[0].id;
    await assert.rejects(
        () =>
            query("select public.change_event_ticket($1,$2,'cancel')", [
                a,
                usedTicket,
            ]),
        /tickets.cannotChange/,
    );
    const normal = (
        await query(
            "select * from public.add_event_ticket_type($1,'General',10,false)",
            [b],
        )
    )[0];
    const ordinary = (
        await query(
            "select * from public.issue_event_tickets($1,$2,1,'pending',$3)",
            [b, normal.id, crypto.randomUUID()],
        )
    )[0];
    await query("select public.change_event_ticket($1,$2,'paid')", [
        b,
        ordinary.id,
    ]);
    await assert.rejects(
        () =>
            query("update public.sessions set currency='USD' where id=$1", [b]),
        /tickets.currencyLocked/,
    );
    const admittedTicket = (
        await query('select public.check_in_event_ticket($1,$2) as result', [
            b,
            ordinary.token,
        ])
    )[0].result;
    assert.equal(
        admittedTicket.status,
        'accepted',
        'Ordinary QR tickets still work after the guest list migration',
    );
    const invitationType = (
        await query(
            'select id from public.event_ticket_types where session_id=$1 and is_guest_list',
            [a],
        )
    )[0].id;
    await assert.rejects(
        () =>
            query('select * from public.issue_event_tickets($1,$2,1,$3,$4)', [
                a,
                invitationType,
                'invitation',
                crypto.randomUUID(),
            ]),
        /tickets.invalidIssue/,
    );
    await assert.rejects(
        () => save(b, id, 'Wrong session', 0, g.revision),
        /tickets.unavailable/,
    );
    await assert.rejects(() => access(b, id), /tickets.unavailable/);
    await assert.rejects(
        () => query('update public.event_guest_groups set companions=99'),
        /permission denied/,
    );
    await assert.rejects(
        () => query('delete from public.event_tickets'),
        /permission denied/,
    );
    const dup = crypto.randomUUID();
    await save(a, dup, 'Manuel Parra', 0);
    assert.equal((await list(a)).length, 2, 'Namesakes are allowed');
    await remove(a, dup);
    await remove(a, dup);
    await role('authenticated', other);
    assert.deepEqual(await list(a), []);
    assert.equal((await summary(a)).accepted, 0);
    for (const fn of [
        () => save(a, crypto.randomUUID(), 'Unauthorized', 0),
        () => access(a, id),
        () => remove(a, id),
    ])
        await assert.rejects(fn, /tickets.unavailable/);
    await assert.rejects(
        () =>
            query('select ticketing_private.save_guest($1,$2,$3,0,0)', [
                a,
                crypto.randomUUID(),
                'Unauthorized',
            ]),
        /tickets.unavailable/,
    );
    await role('anon');
    await assert.rejects(() => list(a), /permission denied/);
    await assert.rejects(
        () => query('select * from public.event_guest_groups'),
        /permission denied/,
    );
    await role('authenticated', owner);
    const solo = crypto.randomUUID();
    await save(b, solo, 'Guest', 0);
    const results = await Promise.allSettled([
        access(b, solo),
        access(b, solo),
    ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal((await list(b))[0].admitted, 1);
    await query("update public.sessions set status='cancelled' where id=$1", [
        b,
    ]);
    await assert.rejects(
        () => access(b, solo, 'undo', 1),
        /tickets.unavailable/,
    );
    await assert.rejects(
        () => save(b, crypto.randomUUID(), 'Cancelled', 0),
        /tickets.unavailable/,
    );
    await query('delete from public.sessions where id=$1', [a]);
    assert.deepEqual(await list(a), []);
    assert.equal(
        (await list(b)).length,
        1,
        'Deleting one session must preserve other lists',
    );
    console.log(
        'Guest list database: ownership, partial check-in, QR sync, retries, edits, duplicates, concurrency and deletion passed.',
    );
    await db.close();
})().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
