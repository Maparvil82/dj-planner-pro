const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs'),
    path = require('node:path'),
    assert = require('node:assert/strict');
const db = new PGlite(),
    owner = '00000000-0000-4000-8000-000000000991',
    other = '00000000-0000-4000-8000-000000000992';
async function role(name, uid = '') {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        uid,
    ]);
    await db.exec(`set role ${name}`);
}
async function call(sql, args = []) {
    return (await db.query(sql, args)).rows;
}
const type = async (session, name, price = 10, invitation = false) =>
    (
        await call('select * from public.add_event_ticket_type($1,$2,$3,$4)', [
            session,
            name,
            price,
            invitation,
        ])
    )[0];
const issue = (
    session,
    kind,
    count = 1,
    payment = 'paid',
    batch = crypto.randomUUID(),
) =>
    call('select * from public.issue_event_tickets($1,$2,$3,$4,$5)', [
        session,
        kind,
        count,
        payment,
        batch,
    ]);
const scan = async (session, token) =>
    (
        await call('select public.check_in_event_ticket($1,$2) as result', [
            session,
            token,
        ])
    )[0].result;
const change = async (session, ticket, action) =>
    (
        await call('select * from public.change_event_ticket($1,$2,$3)', [
            session,
            ticket,
            action,
        ])
    )[0];
const summary = async (session) =>
    (
        await call('select public.event_ticket_summary($1) as result', [
            session,
        ])
    )[0].result;
(async () => {
    await db.exec(
        fs.readFileSync(
            path.join(__dirname, 'fixtures/bookingBase.sql'),
            'utf8',
        ),
    );
    await db.exec(
        fs.readFileSync(
            path.join(
                __dirname,
                '../supabase/migrations/20261008184444_event_ticket_access.sql',
            ),
            'utf8',
        ),
    );
    await db.query('insert into auth.users values($1),($2)', [owner, other]);
    await role('authenticated', owner);
    const a = (
        await call(
            "insert into public.sessions(user_id,date,title,venue) values($1,'2026-10-10','A','Club') returning id",
            [owner],
        )
    )[0].id;
    const b = (
        await call(
            "insert into public.sessions(user_id,date,title,venue) values($1,'2026-10-11','B','Club') returning id",
            [owner],
        )
    )[0].id;
    const general = await type(a, 'General'),
        invite = await type(a, 'Invitation', 0, true),
        otherType = await type(b, 'General');
    await assert.rejects(() => type(a, ' general '), /duplicate key/);
    await assert.rejects(() => type(a, 'No', -1), /check constraint/);
    await assert.rejects(() => type(a, 'No', 1.001), /invalidType/);
    await assert.rejects(() => type(a, 'No', 10, true), /check constraint/);
    await assert.rejects(() => issue(a, otherType.id), /invalidIssue/);
    await assert.rejects(() => issue(a, general.id, 101), /invalidIssue/);
    await assert.rejects(() => issue(a, general.id, 0), /invalidIssue/);
    await assert.rejects(() => issue(a, invite.id, 1, 'paid'), /invalidIssue/);
    await assert.rejects(
        () => issue(a, general.id, 1, 'invitation'),
        /invalidIssue/,
    );
    const batch = crypto.randomUUID(),
        paid = await issue(a, general.id, 3, 'paid', batch);
    assert.equal(new Set(paid.map((t) => t.token)).size, 3);
    const again = await issue(a, general.id, 3, 'paid', batch);
    assert.deepEqual(
        again.map((t) => t.id),
        paid.map((t) => t.id),
    );
    await assert.rejects(
        () => issue(a, general.id, 2, 'paid', batch),
        /invalidIssue/,
    );
    const concurrent = await Promise.all([
        scan(a, paid[0].token),
        scan(a, paid[0].token),
    ]);
    assert.deepEqual(concurrent.map((r) => r.status).sort(), [
        'accepted',
        'already_used',
    ]);
    assert.equal((await scan(a, paid[0].token)).status, 'already_used');
    assert.equal((await scan(b, paid[1].token)).status, 'invalid');
    assert.equal((await scan(a, crypto.randomUUID())).status, 'invalid');
    await change(a, paid[1].id, 'cancel');
    assert.equal((await scan(a, paid[1].token)).status, 'cancelled');
    await assert.rejects(() => change(a, paid[0].id, 'cancel'), /cannotChange/);
    const pending = (await issue(a, general.id, 1, 'pending'))[0];
    assert.equal((await scan(a, pending.token)).status, 'pending');
    assert.equal((await scan(a, pending.token)).status, 'pending');
    await change(a, pending.id, 'paid');
    assert.equal((await scan(a, pending.token)).status, 'accepted');
    const invited = (await issue(a, invite.id, 1, 'invitation'))[0];
    assert.equal((await scan(a, invited.token)).status, 'accepted');
    const report = await summary(a);
    assert.equal(report.issued, 5);
    assert.equal(report.accepted, 3);
    assert.equal(report.paid, 3);
    assert.equal(report.cancelled, 1);
    assert.equal(report.pending, 0);
    assert.equal(report.invited, 1);
    assert.equal(report.revenue, 40);
    assert.equal(report.cancelled_paid_amount, 10);
    assert.equal(report.by_type.find((k) => k.id === general.id).accepted, 2);
    await assert.rejects(
        () => call("update public.sessions set currency='$' where id=$1", [a]),
        /currencyLocked/,
    );
    await change(a, pending.id, 'paid'); // a lost response can be retried safely
    // Direct writes cannot replace QR tokens or undo admissions.
    await assert.rejects(
        () =>
            call('update public.event_tickets set state=$1 where id=$2', [
                'issued',
                paid[0].id,
            ]),
        /permission denied/,
    );
    await assert.rejects(
        () =>
            call('delete from public.event_ticket_types where id=$1', [
                general.id,
            ]),
        /permission denied/,
    );
    await assert.rejects(
        () =>
            call(
                'insert into public.event_ticket_types(session_id,name,price) values($1,$2,10)',
                [a, 'Forged'],
            ),
        /permission denied/,
    );
    await role('authenticated', other);
    assert.equal((await call('select * from public.event_tickets')).length, 0);
    assert.equal(
        (await call('select * from public.event_ticket_types')).length,
        0,
    );
    assert.equal((await summary(a)).issued, 0);
    await assert.rejects(() => type(a, 'Spy'), /unavailable/);
    await assert.rejects(() => issue(a, general.id), /unavailable/);
    await assert.rejects(() => scan(a, paid[2].token), /unavailable/);
    await assert.rejects(() => change(a, paid[2].id, 'cancel'), /unavailable/);
    await role('anon');
    await assert.rejects(() => scan(a, paid[2].token), /permission denied/);
    await assert.rejects(
        () => call('select * from public.event_tickets'),
        /permission denied/,
    );
    await role('authenticated', owner);
    await call("update public.sessions set status='cancelled' where id=$1", [
        a,
    ]);
    await assert.rejects(() => scan(a, paid[2].token), /unavailable/);
    await assert.rejects(() => issue(a, general.id), /unavailable/);
    await change(a, paid[2].id, 'cancel');
    // Deleting one session cascades its tickets without touching another session.
    await issue(b, otherType.id);
    await call('delete from public.sessions where id=$1', [a]);
    assert.equal((await summary(b)).issued, 1);
    await role('postgres');
    assert.equal(
        (
            await call(
                'select count(*) as n from public.event_tickets where session_id=$1',
                [a],
            )
        )[0].n,
        0,
    );
    console.log(
        'Ticket issuance, retries, admissions, totals, cancellation and access control passed.',
    );
    await db.close();
})().catch(async (e) => {
    console.error(e);
    await db.close();
    process.exitCode = 1;
});
