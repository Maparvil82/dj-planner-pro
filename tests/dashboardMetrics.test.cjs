const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(name) {
    const filename = path.resolve(__dirname, `../src/utils/${name}.ts`);
    const loaded = new Module(filename, module);
    loaded.require = (request) =>
        request === './sessionPlanning'
            ? load('sessionPlanning')
            : require(request);
    loaded._compile(
        ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2022,
            },
        }).outputText,
        filename,
    );
    return loaded.exports;
}
const { dashboardMetrics, dashboardChart, periodBounds } =
    load('dashboardMetrics');
const anchor = new Date(2026, 9, 31);
const session = (overrides) => ({
    id: 'gig',
    date: '2026-10-02',
    venue: 'Club',
    venue_id: 'club',
    status: 'confirmed',
    currency: '€',
    earning_type: 'fixed',
    earning_amount: 300,
    start_time: '22:00',
    end_time: '04:00',
    ...overrides,
});
test('dashboard separates confirmed fees, tentative fees and cancelled sessions across currencies', () => {
    const sessions = [
        session({}),
        session({ id: 'usd', currency: '$', earning_amount: 900 }),
        session({ id: 'pending', status: 'pending', earning_amount: 200 }),
        session({ id: 'cancelled', status: 'cancelled', earning_amount: 800 }),
    ];
    const m = dashboardMetrics(
        sessions,
        [{ date: '2026-10-03', amount: '50' }],
        anchor,
        'month',
        'EUR',
        new Date(2026, 9, 4),
    );
    assert.equal(m.revenue, 300);
    assert.equal(m.tentativeRevenue, 200);
    assert.equal(m.balance, 250);
    assert.equal(m.active.length, 3);
    assert.equal(m.hours, 18);
    assert.equal(m.cancelled, 1);
    assert.equal(m.averageFee, 300);
    assert.equal(m.hourlyFee, 50);
    assert.equal(m.venues[0].count, 3);
    const usd = dashboardMetrics(
        sessions,
        [{ date: '2026-10-03', amount: 50 }],
        anchor,
        'month',
        'USD',
    );
    assert.equal(usd.revenue, 900);
    assert.equal(usd.costs, null);
    assert.equal(usd.balance, null);
});
test('performed hours wait until overnight sessions actually end', () => {
    const m = dashboardMetrics(
        [session({})],
        [],
        anchor,
        'month',
        'EUR',
        new Date(2026, 9, 3, 2),
    );
    assert.equal(m.played, 0);
    const ended = dashboardMetrics(
        [session({})],
        [],
        anchor,
        'month',
        'EUR',
        new Date(2026, 9, 3, 4),
    );
    assert.equal(ended.played, 1);
    assert.equal(ended.playedHours, 6);
});
test('free sessions do not dilute paid average, and venue IDs survive renaming', () => {
    const m = dashboardMetrics(
        [
            session({}),
            session({ earning_type: 'free', venue: 'New club name' }),
        ],
        [],
        anchor,
        'month',
        'EUR',
    );
    assert.equal(m.averageFee, 300);
    assert.equal(m.venueCount, 1);
    assert.equal(m.active.length, 2);
});
test('periods use calendar boundaries at month end and across year transitions', () => {
    assert.deepEqual(periodBounds(new Date(2026, 0, 31), 'month', -1), {
        start: '2025-12-01',
        end: '2026-01-01',
    });
    assert.deepEqual(periodBounds(anchor, 'year', -1), {
        start: '2025-01-01',
        end: '2026-01-01',
    });
    const chart = dashboardChart(
        [
            session({ date: '2025-12-20' }),
            session({ date: '2026-01-05', status: 'pending' }),
            session({ date: '2026-01-06', status: 'cancelled' }),
        ],
        new Date(2026, 0, 31),
        'month',
        'EUR',
    );
    assert.equal(chart.length, 6);
    assert.equal(chart[4].revenue, 300);
    assert.equal(chart[5].count, 1);
    assert.equal(chart[5].revenue, 0);
});
test('empty periods have no invented averages or venue rankings', () => {
    const m = dashboardMetrics([], [], anchor, 'month', 'EUR');
    assert.equal(m.averageFee, null);
    assert.equal(m.hourlyFee, null);
    assert.equal(m.revenue, 0);
    assert.equal(m.venueCount, 0);
});
