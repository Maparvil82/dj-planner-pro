const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const file = require('node:path').resolve(__dirname, '../src/utils/statisticsReport.ts');
const loaded = new Module(file, module);
loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
const { buildStatisticsReportHtml } = loaded.exports;
const fixture = { title: 'Informe', period: 'octubre de 2026', currency: 'EUR', generated: '18 oct 2026', sections: [], chart: [], chartTitle: 'Actividad' };
test('user supplied names cannot inject HTML or scripts into a financial report', () => {
    const bad = '<script>alert("data")</script>&';
    const html = buildStatisticsReportHtml({ ...fixture, title: bad, sections: [{ title: bad, hint: bad, headers: [bad], rows: [[bad, '230,50 €']] }], chart: [{ label: bad, count: 3, revenue: '230,50 €' }] });
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(html.includes('230,50 €'));
});
test('zero activity remains printable without invalid chart dimensions', () => {
    const html = buildStatisticsReportHtml({ ...fixture, chart: [{ label: 'oct', count: 0, revenue: '0,00 €' }] });
    assert.ok(!/NaN|Infinity/.test(html));
    assert.ok(html.includes('width:0%'));
});
test('all session rows survive multi-page reports with repeating table headings', () => {
    const html = buildStatisticsReportHtml({ ...fixture, sections: [{ title: 'Sesiones', headers: ['Fecha','Sesión','Caché'], rows: Array.from({ length: 150 }, (_, i) => [`2026-10-01`, `Session ${i}`, `${i},00 €`]) }] });
    assert.ok(html.includes('Session 149'));
    assert.ok(html.includes('table-header-group'));
    assert.equal((html.match(/Session \d+/g) || []).length, 150);
});
