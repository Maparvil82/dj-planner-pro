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
        request === './sessionPlanning' || request === './cities'
            ? load(request.slice(2))
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

const { dashboardInsights } = load('dashboardMetrics');
test('city grouping normalizes accents and whitespace, and does not guess ambiguous venues', () => {
    const venues = [
        { id: 'club', name: 'Club', city: ' Madrid ' },
        { id: 'other', name: 'Other', city: 'MÁDRID' },
        { id: 'a', name: 'Duplicate', city: 'Barcelona' },
        { id: 'b', name: 'Duplicate', city: 'Valencia' },
    ];
    const data = [
        session({ venue_city: ' Madrid ' }),
        session({
            venue_city: 'MÁDRID',
            id: 'other-gig',
            venue_id: 'other',
            venue: 'Old name',
        }),
        session({ id: 'ambiguous', venue_id: undefined, venue: 'Duplicate' }),
        session({ id: 'missing', venue_id: 'deleted' }),
    ];
    const m = dashboardInsights(
        data,
        venues,
        anchor,
        'month',
        'EUR',
        new Date(2026, 9, 1),
    );
    assert.equal(m.cities.length, 1);
    assert.equal(m.cities[0].count, 2);
    assert.equal(m.cities[0].hours, 12);
    assert.equal(m.cities[0].revenue, 600);
    assert.equal(m.unknownCity, 2);
});
test('repeat work requires an earlier completed confirmed appearance, excluding tentative and future history', () => {
    const now = new Date(2026, 9, 1, 12);
    const data = [
        session({ id: 'past', date: '2026-09-10' }),
        session({ id: 'new', date: '2026-10-10' }),
        session({
            id: 'fresh',
            date: '2026-10-11',
            venue: 'New',
            venue_id: 'new',
        }),
    ];
    const m = dashboardInsights(data, [], anchor, 'month', 'EUR', now);
    assert.equal(m.repeatSessions, 1);
    assert.equal(m.repeatRate, 50);
    data[0].status = 'pending';
    assert.equal(
        dashboardInsights(data, [], anchor, 'month', 'EUR', now).repeatSessions,
        0,
    );
});
test('next 30 days uses actual start times and separates tentative income and other currencies', () => {
    const now = new Date(2026, 9, 1, 12);
    const data = [
        session({ date: '2026-10-01', start_time: '10:00', end_time: '15:00' }),
        session({ date: '2026-10-10' }),
        session({ date: '2026-10-11', status: 'pending' }),
        session({ date: '2026-10-12', currency: 'USD' }),
        session({ date: '2026-10-13', status: 'cancelled' }),
        session({ date: '2026-10-31', start_time: '12:00' }),
    ];
    const m = dashboardInsights(data, [], anchor, 'month', 'EUR', now);
    assert.equal(m.nextSessions, 2);
    assert.equal(m.nextPending, 1);
    assert.equal(m.nextRevenue, 300);
    assert.equal(m.nextHours, 12);
});
test('free and unset fees stay distinct, cancellation denominator includes all bookings, hourly ranking excludes tentative and free gigs', () => {
    const data = [
        session({}),
        session({ id: 'free', earning_type: 'free' }),
        session({ id: 'unset', earning_amount: 0 }),
        session({ id: 'pending', status: 'pending', earning_amount: 900 }),
        session({ id: 'cancel', status: 'cancelled' }),
    ];
    const m = dashboardInsights(data, [], anchor, 'month', 'EUR');
    assert.equal(m.free, 1);
    assert.equal(m.unpriced, 1);
    assert.equal(m.paid, 2);
    assert.equal(m.cancellationRate, 20);
    assert.equal(m.averageDuration, 6);
    assert.equal(m.bestRate.rate, 50);
    assert.equal(m.weekdays[5].count, 4);
});

test('payment summary counts receipts independently from fees, guests and cancellations', () => {
    const summary = dashboardMetrics(
        [
            session({ id: 'unpaid', amount_paid: 0 }),
            session({ id: 'partial', amount_paid: 100 }),
            session({ id: 'paid', amount_paid: 300 }),
            session({ id: 'free', earning_type: 'free', earning_amount: 0 }),
            session({ id: 'guest', is_guest: true }),
            session({ id: 'other-currency', currency: '$', amount_paid: 0 }),
            session({ id: 'cancelled', status: 'cancelled', amount_paid: 100 }),
        ],
        [],
        anchor,
        'month',
        'EUR',
    );
    assert.equal(summary.paymentPending.length, 3);
    assert.equal(summary.settled.length, 3);
    assert.equal(summary.cancelled, 1);
    assert.equal(summary.pendingBalance, 500);
    assert.equal(
        summary.paymentPending.length +
            summary.settled.length +
            summary.cancelled,
        summary.selected.length,
    );
});
