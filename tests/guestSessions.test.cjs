const { test } = require('node:test'),
    assert = require('node:assert/strict'),
    fs = require('node:fs'),
    ts = require('typescript');
const original = require.extensions['.ts'];
require.extensions['.ts'] = (m, file) =>
    m._compile(
        ts.transpileModule(fs.readFileSync(file, 'utf8'), {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2022,
            },
        }).outputText,
        file,
    );
const { guestSessions } = require('../src/utils/guestSessions.ts');
if (original) require.extensions['.ts'] = original;
else delete require.extensions['.ts'];
const event = (id, date, extra = {}) => ({
    id,
    user_id: 'owner',
    date,
    start_time: '22:00',
    end_time: '04:00',
    status: 'confirmed',
    booking_timezone: 'Europe/Madrid',
    ...extra,
});
test('overnight session remains active until its actual local end', () => {
    const overnight = event('night', '2026-10-08'),
        next = event('next', '2026-10-09');
    assert.deepEqual(
        guestSessions(
            [next, overnight],
            'owner',
            'upcoming',
            [],
            new Date('2026-10-09T03:59:00+02:00'),
        ).map((s) => s.id),
        ['night', 'next'],
    );
    assert.deepEqual(
        guestSessions(
            [next, overnight],
            'owner',
            'upcoming',
            [],
            new Date('2026-10-09T04:00:00+02:00'),
        ).map((s) => s.id),
        ['next'],
    );
});
test('history only retains existing own lists; cancelled sessions never enter the creation selector', () => {
    const sessions = [
            event('older', '2026-10-01'),
            event('newer', '2026-10-02'),
            event('empty', '2026-10-03'),
            event('cancelled', '2026-10-08', { status: 'cancelled' }),
            event('other', '2026-10-02', { user_id: 'another' }),
            event('guest', '2026-10-02', { is_guest: true }),
            event('future', '2026-10-10'),
        ],
        now = new Date('2026-10-09T12:00:00+02:00');
    assert.deepEqual(
        guestSessions(
            sessions,
            'owner',
            'history',
            ['older', 'newer', 'cancelled', 'other', 'guest'],
            now,
        ).map((s) => s.id),
        ['cancelled', 'newer', 'older'],
    );
    assert.deepEqual(
        guestSessions(sessions, 'owner', 'upcoming', [], now).map((s) => s.id),
        ['future'],
    );
});
