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
        request === './sessionPlanning' || request === './cities' || request === './dashboardMetrics'
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
const { sessionExpenseTotals } = load('sessionExpenseTotals');
test('session expense totals combine currency aliases, keep currencies separate and round cents', () => {
    const rows=[{amount:0.1,currency:'€'},{amount:'0.20',currency:'EUR'},{amount:7.25,currency:'USD'},{amount:2.75,currency:'$'},{amount:5,currency:null}];
    assert.deepEqual(sessionExpenseTotals(rows),{EUR:5.3,USD:10});
});
test('empty expense totals contain no zero badge; invalid numeric amounts do not corrupt totals', () => {
    assert.deepEqual(sessionExpenseTotals([]),{});
    assert.deepEqual(sessionExpenseTotals([{amount:'bad',currency:'EUR'},{amount:12.5,currency:'EUR'}]),{EUR:12.5});
});
