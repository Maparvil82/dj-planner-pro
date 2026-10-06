const { test } = require('node:test'),
    assert = require('node:assert/strict'),
    fs = require('node:fs'),
    ts = require('typescript');
const previous = require.extensions['.ts'];
require.extensions['.ts'] = (m, f) =>
    m._compile(
        ts.transpileModule(fs.readFileSync(f, 'utf8'), {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2022,
            },
        }).outputText,
        f,
    );
const { recentCollaborators } = require('../src/utils/recentCollaborators.ts');
if (previous) require.extensions['.ts'] = previous;
else delete require.extensions['.ts'];
const now = new Date('2026-10-06T12:00:00Z');
const session = (id, date, djs, extra = {}) => ({
    id,
    user_id: 'me',
    date,
    start_time: '22:00',
    end_time: '04:00',
    booking_timezone: 'Europe/Madrid',
    is_collective: true,
    status: 'confirmed',
    djs,
    ...extra,
});
test('recent DJs come from completed sessions, unique by name, and stop at three', async () => {
    const rows = [
        session('future', '2026-10-07', ['Future']),
        session('cancelled', '2026-10-05', ['Cancelled'], {
            status: 'cancelled',
        }),
        session('latest', '2026-10-05', ['A', 'B']),
        session('older', '2026-10-04', [' a ', 'C', 'D']),
    ];
    assert.deepEqual(
        await recentCollaborators(rows, 'me', async () => [], now),
        [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
    );
});
test('linked recommendations retain IDs and exclude declined or pending invitations', async () => {
    const rows = [
        session(
            'linked',
            '2026-10-05',
            ['Pepe', 'Pending', 'Declined', 'Manual'],
            { dj_profile_ids: ['pepe', 'pending', 'declined'] },
        ),
    ];
    const participants = [
        { dj_id: 'pepe', artist_name: 'Pepe', status: 'accepted' },
        { dj_id: 'pending', artist_name: 'Pending', status: 'invited' },
        { dj_id: 'declined', artist_name: 'Declined', status: 'declined' },
    ];
    assert.deepEqual(
        await recentCollaborators(rows, 'me', async () => participants, now),
        [{ name: 'Pepe', id: 'pepe' }, { name: 'Manual' }],
    );
});
test('guest sessions recommend the host and never infer other guests from inaccessible rows', async () => {
    const guest = session('guest', '2026-10-05', ['Me', 'Other pending DJ'], {
        is_guest: true,
        user_id: 'host',
        owner_name: 'Host',
    });
    assert.deepEqual(
        await recentCollaborators(
            [guest],
            'me',
            async () => [
                { dj_id: 'me', artist_name: 'Me', status: 'accepted' },
            ],
            now,
            'Me',
        ),
        [{ name: 'Host', id: 'host' }],
    );
});
test('no collaboration history means no recommendations and no participant lookups', async () => {
    let calls = 0;
    assert.deepEqual(
        await recentCollaborators(
            [
                session('solo', '2026-10-05', ['Nobody'], {
                    is_collective: false,
                }),
            ],
            'me',
            async () => {
                calls++;
                return [];
            },
            now,
        ),
        [],
    );
    assert.equal(calls, 0);
});
test('an overnight session is not history until it finishes in its event time zone', async () => {
    const overnight = session('night', '2026-10-05', ['A']);
    assert.deepEqual(
        await recentCollaborators(
            [overnight],
            'me',
            async () => [],
            new Date('2026-10-06T00:30:00Z'),
        ),
        [],
    );
    assert.deepEqual(
        await recentCollaborators(
            [overnight],
            'me',
            async () => [],
            new Date('2026-10-06T02:00:00Z'),
        ),
        [{ name: 'A' }],
    );
});
