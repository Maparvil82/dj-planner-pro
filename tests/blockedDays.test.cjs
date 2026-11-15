const { test } = require('node:test'),
    assert = require('node:assert/strict'),
    fs = require('node:fs'),
    path = require('node:path'),
    Module = require('node:module'),
    ts = require('typescript');
function load(name) {
    const filename = path.resolve(__dirname, `../src/utils/${name}.ts`),
        m = new Module(filename, module);
    m.require = (r) => (r.startsWith('./') ? load(r.slice(2)) : require(r));
    m._compile(
        ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2022,
            },
        }).outputText,
        filename,
    );
    return m.exports;
}
const { blockedSessionDays } = load('blockedDays');
const input = {
    date: '2026-10-09',
    start_time: '22:00',
    end_time: '04:00',
    recurrence_type: 'none',
};
test('blocks include overnight day but exclude midnight endpoint', () => {
    assert.deepEqual(blockedSessionDays(input, ['2026-10-10']), ['2026-10-10']);
    assert.deepEqual(
        blockedSessionDays({ ...input, end_time: '00:00' }, ['2026-10-10']),
        [],
    );
    assert.deepEqual(
        blockedSessionDays(
            { ...input, start_time: '00:00', end_time: '00:00' },
            ['2026-10-10'],
        ),
        [],
    );
});
test('recurring sessions check each date and overnight days', () => {
    assert.deepEqual(
        blockedSessionDays(
            {
                ...input,
                recurrence_type: 'weekly',
                recurrence_end_date: '2026-10-23',
            },
            ['2026-10-17', '2026-10-24', '2026-10-11'],
        ),
        ['2026-10-17', '2026-10-24'],
    );
});
