const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function loadUtility(name) {
    const filename = path.resolve(__dirname, `../src/utils/${name}.ts`);
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    });
    const loaded = new Module(filename, module);
    loaded._compile(compiled.outputText, filename);
    return loaded.exports;
}
const { recurrenceDates, findSessionConflicts, sessionRange, sessionDuration, sessionEarnings, sessionBalance, localDateString, earningsByCurrency } = loadUtility('sessionPlanning');
const { buildSessionCalendar } = loadUtility('sessionCalendar');
const session = (overrides = {}) => ({ id: 'test-session', user_id: 'test-owner', title: 'Club night', venue: 'Venue', date: '2026-10-02', start_time: '22:00', end_time: '04:00', earning_type: 'hourly', earning_amount: 50, currency: '€', status: 'confirmed', ...overrides });

test('overnight range ends on the following local day', () => {
    const { start, end } = sessionRange(session());
    assert.equal(start.getDate(), 2);
    assert.equal(end.getDate(), 3);
    assert.equal(end.getHours(), 4);
    assert.equal(sessionDuration(session()), 6);
});
test('detects overlap with a gig starting after midnight on the next date', () => {
    assert.equal(findSessionConflicts([session()], [session({ date: '2026-10-03', start_time: '02:00', end_time: '05:00' })]).length, 1);
});
test('detects overlap from the previous night', () => {
    assert.equal(findSessionConflicts([session({ date: '2026-10-03', start_time: '02:00', end_time: '05:00' })], [session()]).length, 1);
});
test('back-to-back gigs and cancelled gigs do not conflict', () => {
    assert.deepEqual(findSessionConflicts([session()], [session({ start_time: '20:00', end_time: '22:00' }), session({ status: 'cancelled' })]), []);
});
test('a conflict on a later recurring date is detected', () => {
    const dates = recurrenceDates({ date: '2026-10-02', recurrence_type: 'weekly', recurrence_end_date: '2026-10-16' });
    assert.equal(findSessionConflicts(dates.map(date => session({ date })), [session({ date: '2026-10-16' })]).length, 1);
});
test('month-end recurrence remains anchored to the original day', () => {
    assert.deepEqual(recurrenceDates({ date: '2026-01-31', recurrence_type: 'monthly', recurrence_end_date: '2026-04-30' }), ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
});
test('leap-year yearly recurrence recovers February 29', () => {
    const dates = recurrenceDates({ date: '2024-02-29', recurrence_type: 'yearly', recurrence_end_date: '2028-02-29' });
    assert.equal(dates[1], '2025-02-28');
    assert.equal(dates[4], '2028-02-29');
});
test('quarterly and six-month recurrence preserve the original date', () => {
    assert.deepEqual(recurrenceDates({ date: '2026-01-31', recurrence_type: 'quarterly', recurrence_end_date: '2026-07-31' }), ['2026-01-31', '2026-04-30', '2026-07-31']);
    assert.deepEqual(recurrenceDates({ date: '2026-01-31', recurrence_type: 'biannually', recurrence_end_date: '2027-01-31' }), ['2026-01-31', '2026-07-31', '2027-01-31']);
});
test('rejects reversed recurrence and excessive series before saving', () => {
    assert.throws(() => recurrenceDates({ date: '2026-10-02', recurrence_type: 'daily', recurrence_end_date: '2026-10-01' }), /invalid_recurrence/);
    assert.throws(() => recurrenceDates({ date: '2026-01-01', recurrence_type: 'daily', recurrence_end_date: '2028-01-01' }), /recurrence_limit/);
});
test('single occurrence recurrence is allowed', () => {
    assert.deepEqual(recurrenceDates({ date: '2026-10-02', recurrence_type: 'weekly', recurrence_end_date: '2026-10-02' }), ['2026-10-02']);
});
test('payments distinguish fee, deposit and remaining balance', () => {
    assert.equal(sessionEarnings(session()), 300);
    assert.equal(sessionBalance(session({ amount_paid: 100 })), 200);
    assert.equal(sessionBalance(session({ amount_paid: 300 })), 0);
    assert.equal(sessionBalance(session({ amount_paid: 400 })), 0);
    assert.equal(sessionEarnings(session({ earning_type: 'free' })), 0);
});
test('database numeric strings are treated as money, not concatenated', () => {
    assert.equal(sessionEarnings(session({ earning_type: 'fixed', earning_amount: '120.50' })), 120.5);
    assert.equal(sessionBalance(session({ earning_type: 'fixed', earning_amount: '120.50', amount_paid: '20.50' })), 100);
});
test('calendar export includes the next-day end and a reminder', () => {
    const calendar = buildSessionCalendar(session(), new Date('2026-10-02T10:00:00Z'));
    assert.match(calendar, /DTSTART:20261002T220000\r\nDTEND:20261003T040000/);
    assert.match(calendar, /TRIGGER:-PT2H/);
    assert.match(calendar, /DTSTAMP:20261002T100000Z/);
    assert.ok(calendar.endsWith('END:VCALENDAR\r\n'));
    assert.ok(!calendar.includes('earning_amount'));
});
test('calendar handles year boundaries and cancelled events', () => {
    const calendar = buildSessionCalendar(session({ date: '2026-12-31', status: 'cancelled' }));
    assert.match(calendar, /DTEND:20270101T040000/);
    assert.match(calendar, /STATUS:CANCELLED/);
    assert.ok(!calendar.includes('VALARM'));
});
test('calendar escapes text and folds UTF-8 without corrupting emoji', () => {
    const title = 'DJ 🎧; Friends, Live\\Set\n'.repeat(12);
    const calendar = buildSessionCalendar(session({ title }));
    for (const line of calendar.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75);
    const unfolded = calendar.replace(/\r\n /g, '');
    assert.ok(unfolded.includes('DJ 🎧\\; Friends\\, Live\\\\Set\\n'));
});
test('local calendar dates use the device day', () => {
    assert.equal(localDateString(new Date(2026, 9, 2, 23, 30)), '2026-10-02');
});
test('money totals keep different currencies separate and ignore cancelled gigs', () => {
    assert.deepEqual(earningsByCurrency([
        session({ earning_type: 'fixed', earning_amount: 250 }),
        session({ earning_type: 'fixed', earning_amount: 400, currency: '$' }),
        session({ earning_type: 'fixed', earning_amount: 1000, status: 'cancelled' })
    ]), { '€': 250, '$': 400 });
});

test('invited sessions never contribute another DJs fee or currency to own income', () => {
    const guest = session({ is_guest: true, earning_type: 'fixed', earning_amount: 9999, currency: '$' });
    assert.equal(sessionEarnings(guest), 0);
    assert.deepEqual(earningsByCurrency([guest]), {});
});
