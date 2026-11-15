const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const previous = require.extensions['.ts'];
require.extensions['.ts'] = (module, filename) =>
    module._compile(
        ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2022,
            },
        }).outputText,
        filename,
    );
const {
    sessionDisplayTitle,
    sessionDisplaySubtitle,
} = require('../src/utils/sessionNaming.ts');
const { validateSessionInput } = require('../src/utils/sessionWorkflow.ts');
const { buildSessionCalendar } = require('../src/utils/sessionCalendar.ts');
if (previous) require.extensions['.ts'] = previous;
else delete require.extensions['.ts'];
const input = {
    title: '',
    venue: 'Sala X',
    date: '2027-01-01',
    start_time: '22:00',
    end_time: '04:00',
    earning_type: 'free',
};
const t = (key, options) =>
    key === 'sessionNaming.atVenue' ? `Sesión en ${options.venue}` : 'Sesión';
test('unnamed events persist an empty name and still require a venue', () => {
    const saved = validateSessionInput({
        ...input,
        title: '   ',
        venue: ' Sala X ',
    });
    assert.equal(saved.title, '');
    assert.equal(saved.venue, 'Sala X');
    assert.throws(
        () => validateSessionInput({ ...input, venue: ' ' }),
        /missing_fields/,
    );
    assert.equal(sessionDisplayTitle(saved, t), 'Sesión en Sala X');
    assert.equal(saved.title, '');
    assert.equal(
        sessionDisplayTitle({ ...saved, venue: 'Hotel Alameda' }, t),
        'Sesión en Hotel Alameda',
    );
});
test('explicit names win and subtitle avoids repeating the unnamed venue', () => {
    assert.equal(
        sessionDisplayTitle({ ...input, title: ' Closing Party ' }, t),
        'Closing Party',
    );
    assert.equal(
        sessionDisplaySubtitle({ ...input, venue_city: 'Sevilla' }),
        'Sevilla',
    );
    assert.equal(
        sessionDisplaySubtitle({
            ...input,
            title: 'Closing Party',
            venue_city: 'Sevilla',
        }),
        'Sala X',
    );
    assert.equal(sessionDisplaySubtitle(input), '');
    assert.equal(
        sessionDisplaySubtitle({ ...input, city: 'Madrid' }),
        'Madrid',
    );
    assert.equal(
        sessionDisplayTitle({ title: null, venue: null }, t),
        'Sesión',
    );
});
test('calendar summary and reminder receive the same localized automatic title', () => {
    const name = sessionDisplayTitle(input, t);
    const calendar = buildSessionCalendar(
        { ...input, id: 'fixture' },
        new Date('2026-10-03T12:00:00Z'),
        name,
    );
    assert.ok(calendar.includes('SUMMARY:Sesión en Sala X'));
    assert.ok(calendar.includes('DESCRIPTION:Sesión en Sala X'));
});
test('all seven languages provide optional label, help and a venue-based title', () => {
    for (const lang of ['es', 'en', 'de', 'fr', 'it', 'pt', 'ja']) {
        const copy = JSON.parse(
            fs.readFileSync(`src/i18n/languages/${lang}.json`, 'utf8'),
        ).sessionNaming;
        assert.ok(copy.label && copy.hint && copy.placeholder && copy.untitled);
        assert.ok(copy.atVenue.includes('{{venue}}'));
        assert.ok(
            sessionDisplayTitle(input, (key, options) =>
                key.endsWith('atVenue')
                    ? copy.atVenue.replace('{{venue}}', options.venue)
                    : copy.untitled,
            ).includes('Sala X'),
        );
    }
});
