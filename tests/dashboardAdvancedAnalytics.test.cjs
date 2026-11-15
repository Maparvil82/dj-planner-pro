const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(name) {
    const filename = path.resolve(__dirname, `../src/utils/${name}.ts`);
    const loaded = new Module(filename, module);
    loaded.require = request => request.startsWith('./') ? load(request.slice(2)) : require(request);
    loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, filename);
    return loaded.exports;
}
const { dashboardAdvancedAnalytics } = load('dashboardAdvancedAnalytics');
const now = new Date('2026-10-12T12:00:00Z');
const anchor = new Date(2026, 9, 12);
const gig = overrides => ({ id: 'a', venue: 'Club A', venue_id: 'club-a', date: '2026-10-02', status: 'confirmed', currency: 'EUR', earning_type: 'fixed', earning_amount: 300, start_time: '20:00', end_time: '22:00', booking_timezone: 'UTC', ...overrides });
const expense = overrides => ({ id: 'e', session_id: 'a', currency: 'EUR', date: '2026-10-02', amount: 50, ...overrides });
const report = (sessions, expenses = [], currency = 'EUR') => dashboardAdvancedAnalytics(sessions, expenses, [], anchor, 'month', currency, now);
test('margin uses linked costs regardless of expense date; no double deductions or currency mixing', () => {
    const result = report([gig({}), gig({ id: 'usd', currency: 'USD', earning_amount: 999 })], [
        expense({ date: '2026-11-01', amount: 90 }), expense({ id: 'included', amount: 100, included_in_agreement: true }),
        expense({ id: 'usd-cost', currency: 'USD', amount: 900 }), expense({ id: 'general', session_id: null, amount: 40 }),
    ]);
    assert.equal(result.fee, 300); assert.equal(result.costs, 90); assert.equal(result.margin, 210);
    assert.equal(result.hourlyMargin, 105); assert.equal(result.marginPercent, 70); assert.equal(result.unallocatedCosts, 40);
    assert.equal(result.rows[0].expenseCount, 1); assert.equal(result.noExpenses, 0);
});
test('future, cancelled, pending, guest and unsettled agreements do not inflate realized analytics', () => {
    const result = report([gig({}), gig({ id: 'free', earning_type: 'free', earning_amount: 0 }),
        gig({ id: 'future', date: '2026-10-20' }), gig({ id: 'cancelled', status: 'cancelled' }),
        gig({ id: 'pending', status: 'pending' }), gig({ id: 'guest', is_guest: true }),
        gig({ id: 'agreement', earning_type: 'agreement', fee_agreement: { settled: false } }),
        gig({ id: 'settled', earning_type: 'agreement', fee_agreement: { settled: true }, earning_amount: 120 }),
    ], [expense({ session_id: 'free', amount: 20 })]);
    assert.equal(result.rows.length, 3); assert.equal(result.margin, 400); assert.equal(result.unsettled, 1);
    const free = result.rows.find(row => row.session.id === 'free');
    assert.equal(free.margin, -20); assert.equal(free.marginPercent, null);
    const october = result.trend.at(-1); assert.equal(october.sessions.length, 2); assert.equal(october.medianFee, 210);
});
test('trend reports medians rather than means, with absent months distinct from zero', () => {
    const result = report([gig({ earning_amount: 100 }), gig({ id: 'b', earning_amount: 200 }), gig({ id: 'c', earning_amount: 5000 })]);
    assert.equal(result.trend.at(-1).medianFee, 200); assert.equal(result.trend.at(-1).medianHourly, 100);
    assert.equal(result.trend.at(-2).medianFee, null); assert.equal(result.trend.length, 12);
});
test('venue ranks use totals and weighted performance hours; concentration excludes other currencies', () => {
    const result = report([gig({ earning_amount: 400 }), gig({ id: 'a2', earning_amount: 200, end_time: '00:00' }),
        gig({ id: 'b', venue: 'Club B', venue_id: 'club-b', earning_amount: 400 }), gig({ id: 'usd', currency: '$', earning_amount: 3000 })], [expense({ amount: 100 })]);
    const a = result.venues.find(v => v.key === 'club-a');
    assert.equal(a.margin, 500); assert.equal(a.hourlyMargin, 500 / 6);
    assert.equal(result.topShare, 60); assert.equal(result.topThreeShare, 100);
    assert.equal(result.concentration.length, 2);
});
test('aging uses exact 30/31/60/61/90/91 day boundaries, remaining balances and all-history scope', () => {
    const sessions = [0, 30, 31, 60, 61, 90, 91].map(days => {
        const end = new Date(now.getTime() - days * 86400000);
        return gig({ id: String(days), date: end.toISOString().slice(0, 10), start_time: '10:00', end_time: '12:00', earning_amount: 100, amount_paid: 25 });
    });
    const result = report([...sessions, gig({ id: 'paid', amount_paid: 300 }), gig({ id: 'future', date: '2026-10-13' })]);
    assert.deepEqual(result.aging.map(b => b.sessions.length), [2, 2, 2, 1]);
    assert.deepEqual(result.aging.map(b => b.amount), [150, 150, 150, 75]);
    assert.equal(result.aging.at(-1).sessions[0].date.startsWith('2026-07'), true);
});
test('empty data and free gigs avoid divisions by zero and non-finite metrics', () => {
    const empty = report([]); assert.equal(empty.hourlyMargin, null); assert.equal(empty.marginPercent, null); assert.equal(empty.topShare, null);
    const free = report([gig({ earning_type: 'free' })]); assert.equal(free.marginPercent, null); assert.equal(free.concentration.length, 0);
});
test('money aggregates in cents and venue IDs survive renames', () => {
    const result = report([gig({ earning_amount: 0.1 }), gig({ id: 'b', venue: 'Renamed', earning_amount: 0.2 })]);
    assert.equal(result.fee, 0.3); assert.equal(result.venues.length, 1); assert.equal(result.topShare, 100);
});
