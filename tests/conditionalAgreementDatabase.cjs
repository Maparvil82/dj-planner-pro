const { PGlite } = require('@electric-sql/pglite'),
    fs = require('node:fs'),
    path = require('node:path'),
    assert = require('node:assert/strict'),
    ts = require('typescript'),
    Module = require('node:module');
const file = path.resolve(__dirname, '../src/utils/feeAgreement.ts'),
    mod = new Module(file, module);
mod._compile(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
        },
    }).outputText,
    file,
);
const { emptyConditionalAgreement, calculateConditionalAgreement } =
    mod.exports;
const db = new PGlite(),
    owner = '00000000-0000-4000-8000-000000000991',
    other = '00000000-0000-4000-8000-000000000992';
const plan = (changes = {}) => ({
    ...emptyConditionalAgreement(),
    tickets: [
        {
            name: 'General',
            price: 10,
            estimate: 100,
            sold: 100,
            refunded: 0,
            invited: 20,
        },
    ],
    ...changes,
});
const migrate = (n) =>
    db.exec(
        fs.readFileSync(
            path.join(__dirname, '../supabase/migrations', n),
            'utf8',
        ),
    );
async function role(name, uid = '') {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        uid,
    ]);
    await db.exec(`set role ${name}`);
}
async function create(a = plan(), date = '2020-01-01', dates = [date]) {
    return (
        await db.query(
            'select * from public.create_session_series($1::jsonb,$2::date[])',
            [
                JSON.stringify({
                    date,
                    title: 'Fixture',
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
            'update public.sessions set fee_agreement=$1::jsonb,earning_type=$3,earning_amount=99999 where id=$2 returning *',
            [JSON.stringify(a), id, 'agreement'],
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
    for (const n of [
        '20261002173802_free_session_limit.sql',
        '20261002173934_private_subscription_usage.sql',
        '20261004002946_fee_agreements.sql',
    ])
        await migrate(n);
    await db.exec(
        `alter table public.sessions add column booking_timezone text default 'Europe/Madrid'; alter table public.sessions add column amount_paid numeric default 0; create schema community_private; grant usage on schema community_private to authenticated; create function community_private.session_end_at(s public.sessions) returns timestamptz language sql stable as $$ select (s.date+s.end_time::time+case when s.end_time::time<=s.start_time::time then interval '1 day' else interval '0' end) at time zone coalesce(s.booking_timezone,'Europe/Madrid') $$;`,
    );
    await migrate('20261006145027_conditional_sessions_v2.sql');
    await migrate('20261007094222_conditional_expense_items.sql');
    await migrate('20261008011500_ticket_fee_price_limit.sql');
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
    assert.equal(Number(first.earning_amount), 0);
    assert.equal(
        Number(
            (await update(first.id, { ...plan(), settled: true }))
                .earning_amount,
        ),
        700,
    );
    const variants = [
        plan({
            ticketMode: 'percent',
            ticketValue: 70,
            ticketBasis: 'net',
            barPercent: 10,
            barBasis: 'net',
            actual: {
                ticketDeductions: 50,
                bar: 1000,
                barDeductions: 100,
                expenses: 30,
            },
        }),
        plan({
            fixed: 300,
            fixedMode: 'versus',
            minimum: 400,
            maximum: 1000,
            bonusThreshold: 100,
            bonusAmount: 100,
            actual: {
                ticketDeductions: 0,
                bar: 0,
                barDeductions: 0,
                expenses: 50,
            },
        }),
        plan({
            split: 'fixed',
            participants: [
                { name: 'Me', share: 999 },
                { name: 'Other', share: 200 },
            ],
        }),
        plan({
            ticketMode: 'dj_fixed',
            ticketValue: 0.01,
            tickets: [
                {
                    name: 'One',
                    price: 1,
                    estimate: 1,
                    sold: 1,
                    refunded: 0,
                    invited: 0,
                },
            ],
            split: 'percent',
            participants: [
                { name: 'Me', share: 0 },
                { name: 'Other', share: 100 },
            ],
        }),
    ];
    variants.push(
        plan({
            fixed: 200,
            expenseItems: [
                { concept: 'Transport', type: 'fixed', value: 20 },
                { concept: 'Agent', type: 'percent', value: 10 },
                { concept: 'Production', type: 'percent', value: 5 },
            ],
        }),
    );
    variants.push(
        plan({
            expenseItems: [
                { concept: 'Old + new', type: 'percent', value: 33.33 },
            ],
            actual: {
                ticketDeductions: 0,
                bar: 0,
                barDeductions: 0,
                expenses: 15,
            },
        }),
    );
    for (let i = 0; i < 40; i++)
        variants.push(
            plan({
                ticketMode: 'percent',
                ticketValue: 33.33,
                barPercent: 7.73,
                split: 'percent',
                participants: [
                    { name: 'Me', share: 33.33 },
                    { name: 'B', share: 33.33 },
                    { name: 'C', share: 33.34 },
                ],
                tickets: [
                    {
                        name: 'Tier',
                        price: 3.17,
                        estimate: i,
                        sold: i,
                        refunded: 0,
                        invited: 2,
                    },
                ],
                actual: {
                    ticketDeductions: 0,
                    bar: Number((i * 1.13).toFixed(2)),
                    barDeductions: 0,
                    expenses: 0,
                },
            }),
        );
    for (const a of variants) {
        const row = await create(a);
        const saved = await update(row.id, { ...a, settled: true });
        assert.equal(
            Number(saved.earning_amount),
            calculateConditionalAgreement(a, true).owner,
        );
    }
    await assert.rejects(
        () => create(plan({ ticketMode: 'dj_fixed', ticketValue: 11 })),
        /feeExceedsPrice/,
    );
    const tooHigh = plan({ ticketMode: 'dj_fixed', ticketValue: 6 });
    tooHigh.tickets.push({ ...tooHigh.tickets[0], name: 'Early', price: 5 });
    await assert.rejects(() => create(tooHigh), /feeExceedsPrice/);
    const future = await create(plan(), '2099-01-01');
    await assert.rejects(
        () => update(future.id, { ...plan(), settled: true }),
        /notFinished/,
    );
    await assert.rejects(
        () => create({ ...plan(), settled: true }),
        /singleSession/,
    );
    await assert.rejects(
        () => create(plan({ ticketValue: 11 })),
        /invalidTickets/,
    );
    await assert.rejects(
        () =>
            create(
                plan({
                    split: 'percent',
                    participants: [{ name: 'Me', share: 99 }],
                }),
            ),
        /invalidSplit/,
    );
    await assert.rejects(
        () =>
            update(
                first.id,
                plan({
                    settled: true,
                    actual: {
                        ticketDeductions: 1001,
                        bar: 0,
                        barDeductions: 0,
                        expenses: 0,
                    },
                }),
            ),
        /deductionsTooHigh/,
    );
    await assert.rejects(() => create({ ...plan(), version: '2' }), /invalid/);
    // Convert only one existing simple occurrence and preserve recorded payments.
    const series = await create(plan(), '2020-02-01', [
        '2020-02-01',
        '2020-02-08',
    ]);
    await db.query(
        "update public.sessions set earning_type='fixed',earning_amount=250,amount_paid=50 where id=$1 or parent_session_id=$1",
        [series.id],
    );
    const rows = (
        await db.query(
            'select * from public.sessions where id=$1 or parent_session_id=$1',
            [series.id],
        )
    ).rows;
    const converted = await update(rows[0].id, plan());
    assert.equal(Number(converted.amount_paid), 50);
    assert.equal(Number(converted.earning_amount), 0);
    assert.equal(
        (
            await db.query(
                'select earning_type from public.sessions where id=$1',
                [rows[1].id],
            )
        ).rows[0].earning_type,
        'fixed',
    );
    await assert.rejects(
        () =>
            create(
                plan({
                    expenseItems: [{ concept: '', type: 'fixed', value: 10 }],
                }),
            ),
        /conditionalCosts.invalid/,
    );
    await assert.rejects(
        () =>
            create(
                plan({
                    expenseItems: [
                        { concept: 'Agent', type: 'percent', value: 101 },
                    ],
                }),
            ),
        /invalidPercent/,
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
        () => update(first.id, plan({ fixed: 100 })),
        /proRequired/,
    );
    assert.ok(
        (await db.query('select * from public.sessions')).rows.length > 0,
    );
    console.log(
        'PASS: 46 server/client calculations, Pro enforcement, date validation, malicious amounts ignored, refunds, per-occurrence conversion, payments preserved and RLS.',
    );
})()
    .catch((e) => {
        console.error(e);
        process.exitCode = 1;
    })
    .finally(() => db.close());
