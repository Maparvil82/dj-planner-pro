const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const mod = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/updates/versionUpdates.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: mod.exports, module: mod });
const { updatesForVersion } = mod.exports;
test('calendar announcements ship only with 1.0.6 and preserve existing updates', () => {
    const remote = [
        { id: 'feedback', kind: 'release', version: '1.0.6' },
        { id: 'previous', kind: 'release', version: '1.0.5' },
        { id: 'payments', kind: 'roadmap', version: null },
        { id: 'future', kind: 'roadmap', version: '1.0.7' },
    ];
    const current = updatesForVersion(remote, '1.0.6');
    assert.deepEqual(Array.from(current, i => i.id), ['feedback', 'payments', 'calendar-history-1.0.6', 'self-employed-djs-1.0.6']);
    assert.equal(updatesForVersion(current, '1.0.6').length, current.length);
    assert.deepEqual(Array.from(updatesForVersion(remote, '1.0.5'), i => i.id), ['previous', 'payments']);
    assert.equal(remote.length, 4);
    for (const item of current.filter(i => i.content)) {
        for (const language of ['es','en','de','fr','it','pt','ja']) {
            assert(item.content[language].title);
            assert(item.content[language].body);
        }
    }
});
