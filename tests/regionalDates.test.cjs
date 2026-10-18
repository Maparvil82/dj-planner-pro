const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const m = { exports: {} };
new Function('exports', ts.transpileModule(fs.readFileSync('src/i18n/regionalDates.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(m.exports);
const { regionalDateLocale, regionalFirstDay, formatRegionalDate } = m.exports;
test('Spain uses day/month/year and Monday; interface language preserves region', () => {
    const locale = regionalDateLocale('es', 'es-ES', 'ES');
    assert.equal(locale, 'es-ES');
    assert.equal(formatRegionalDate('2026-10-09', locale), '09/10/2026');
    assert.equal(regionalFirstDay(locale, 2), 1);
    assert.equal(regionalFirstDay(locale), 1);
    assert.equal(regionalDateLocale('en', 'es-ES', 'ES'), 'en-ES');
});
test('US, UK and Japan retain their own ordering and first weekday', () => {
    assert.equal(formatRegionalDate('2026-10-09', 'en-US'), '10/09/2026');
    assert.equal(formatRegionalDate('2026-10-09', 'en-GB'), '09/10/2026');
    assert.equal(regionalFirstDay('en-US', 1), 0);
    assert.equal(regionalFirstDay('en-GB', 2), 1);
    assert.equal(regionalFirstDay('ja-JP', 1), 0);
    assert.equal(regionalFirstDay('ar-EG', 7), 6);
});
test('device calendar override and region fallback work without date shifts', () => {
    assert.equal(regionalFirstDay('es-ES', 1), 0);
    assert.equal(regionalDateLocale('pt', 'pt-BR', null), 'pt-BR');
    assert.equal(formatRegionalDate('2026-01-01', 'es-ES'), '01/01/2026');
});
