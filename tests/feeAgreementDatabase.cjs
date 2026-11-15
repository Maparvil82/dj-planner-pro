const { PGlite } = require('@electric-sql/pglite'),
    fs = require('node:fs'),
    path = require('node:path'),
    assert = require('node:assert/strict');
const db = new PGlite();
const owner = '00000000-0000-4000-8000-000000000991',
    other = '00000000-0000-4000-8000-000000000992';
const migrate = (n) =>
    db.exec(
        fs.readFileSync(
            path.join(__dirname, '../supabase/migrations', n),
            'utf8',
        ),
    );
const agreement = {
    version: 1,
    timezone: 'Europe/Madrid',
    fixed: 100,
    perTicket: 2,
    entryPercent: 10,
    barPercent: 5,
    minimum: 0,
    expenses: 20,
    split: 'percent',
    participants: [
        { name: 'Me', share: 60 },
        { name: 'Pepe', share: 40 },
    ],
    estimate: { tickets: 200, entries: 2000, bar: 4000 },
    actual: { tickets: 100, entries: 1000, bar: 2000 },
    settled: false,
};
async function role(name, uid = '') {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        uid,
    ]);
    await db.exec(`set role ${name}`);
}
async function create(a = agreement, date = '2020-01-01', dates = [date]) {
    return (
        await db.query(
            'select * from public.create_session_series($1::jsonb,$2::date[])',
            [
                JSON.stringify({
                    date,
                    title: '',
                    venue: 'Fixture',
                    start_time: '22:00',
                    end_time: '04:00',
                    earning_type: 'agreement',
                    earning_amount: 99999,
                    fee_agreement: a,
                }),
                dates,
            ],
        )
    ).rows[0];
}
async function update(id, a) {
    return (
        await db.query(
            'update public.sessions set fee_agreement=$1::jsonb,earning_amount=99999 where id=$2 returning *',
            [JSON.stringify(a), id],
        )
    ).rows[0];
}
(async () => {
    await db.exec(
        fs.readFileSync(
            path.join(__dirname, 'fixtures/bookingBase.sql'),
            'utf8',
        ),
    );
    await migrate('20261002173802_free_session_limit.sql');
    await migrate('20261002173934_private_subscription_usage.sql');
    await migrate('20261004002946_fee_agreements.sql');
    await db.query('insert into auth.users values($1),($2)', [owner, other]);
    await role('authenticated', owner);
    await assert.rejects(() => create(), /proRequired/);
    await role('postgres');
    await db.query(
        "select public.sync_subscription_access($1,now()+interval '5 minutes')",
        [owner],
    );
    await role('authenticated', owner);
    const first = await create();
    assert.equal(
        Number(first.earning_amount),
        0,
        'forecast included as income',
    );
    const result = await update(first.id, { ...agreement, settled: true });
    assert.equal(
        Number(result.earning_amount),
        288,
        'server calculation differs',
    );
    await assert.rejects(
        () =>
            update(first.id, {
                ...agreement,
                settled: true,
                split: 'percent',
                participants: [{ name: 'Me', share: 99 }],
            }),
        /invalidSplit/,
    );
    const pennies = await create({
        ...agreement,
        fixed: 0,
        perTicket: 0,
        barPercent: 0,
        expenses: 0,
        split: 'equal',
        participants: [{ name: 'Me', share: 0 }],
        actual: { tickets: 0, entries: 100.75, bar: 0 },
    });
    assert.equal(
        Number(
            (
                await update(pennies.id, {
                    ...pennies.fee_agreement,
                    settled: true,
                })
            ).earning_amount,
        ),
        10.08,
    );
    const future = await create(agreement, '2099-01-01');
    await assert.rejects(
        () => update(future.id, { ...agreement, settled: true }),
        /notFinished/,
    );
    await assert.rejects(
        () => create({ ...agreement, settled: true }),
        /singleSession/,
    );
    await assert.rejects(
        () => create({ ...agreement, timezone: 'invalid' }),
        /invalid/,
    );
    await assert.rejects(
        () => create({ ...agreement, split: null }),
        /invalid/,
    );
    const series = await create(agreement, '2020-02-01', [
        '2020-02-01',
        '2020-02-08',
    ]);
    const rows = (
        await db.query(
            'select * from public.sessions where id=$1 or parent_session_id=$1',
            [series.id],
        )
    ).rows;
    assert.equal(rows.length, 2);
    assert.ok(
        rows.every(
            (r) =>
                Number(r.earning_amount) === 0 && r.fee_agreement.fixed === 100,
        ),
    );
    await update(rows[0].id, { ...agreement, settled: true });
    assert.equal(
        Number(
            (
                await db.query(
                    'select earning_amount from public.sessions where id=$1',
                    [rows[1].id],
                )
            ).rows[0].earning_amount,
        ),
        0,
    );
    await role('authenticated', other);
    assert.equal(
        (await db.query('select * from public.sessions')).rows.length,
        0,
    );
    await role('postgres');
    await db.query(
        "select public.sync_subscription_access($1,now()-interval '1 minute')",
        [owner],
    );
    await role('authenticated', owner);
    await assert.rejects(
        () => update(first.id, { ...agreement, fixed: 500, settled: true }),
        /proRequired/,
    );
    await db.query('update public.sessions set status=$1 where id=$2', [
        'cancelled',
        first.id,
    ]);
    console.log(
        'PASS: server Pro enforcement, exact money, private access, estimates excluded, date gate, per-occurrence settlement and expired-plan read/update preservation.',
    );
})()
    .catch((e) => {
        console.error(e);
        process.exitCode = 1;
    })
    .finally(() => db.close());
