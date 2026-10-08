const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
    ts = require('typescript'),
    Module = require('node:module');
const path = require('node:path');
const filename = path.resolve(__dirname, '../src/utils/feeAgreement.ts');
const m = new Module(filename, module);
m._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
        },
    }).outputText,
    filename,
);
const {
    emptyFeeAgreement,
    calculateFeeAgreement,
    agreementAmount,
    validateFeeAgreement,
} = m.exports;
const fee = (x = {}) => ({ ...emptyFeeAgreement(), fixed: 100, ...x });
test('combines fixed, ticket count, entry revenue and bar revenue before splitting', () => {
    const a = fee({
        perTicket: 2,
        entryPercent: 10,
        barPercent: 5,
        expenses: 20,
        split: 'percent',
        participants: [
            { name: 'Me', share: 60 },
            { name: 'Pepe', share: 40 },
        ],
        actual: { tickets: 100, entries: 1000, bar: 2000 },
    });
    const r = calculateFeeAgreement(a, true);
    assert.equal(r.total, 500);
    assert.equal(r.distributable, 480);
    assert.deepEqual(r.shares, [288, 192]);
    assert.equal(agreementAmount(a), 0);
    assert.equal(agreementAmount({ ...a, settled: true }), 288);
});
test('minimum is a floor, not an additional fee', () => {
    assert.equal(calculateFeeAgreement(fee({ minimum: 250 })).owner, 250);
    assert.equal(calculateFeeAgreement(fee({ minimum: 50 })).owner, 100);
});
test('splits every cent, including percentage rounding and equal shares', () => {
    assert.deepEqual(
        calculateFeeAgreement(
            fee({
                fixed: 100,
                participants: Array.from({ length: 3 }, () => ({
                    name: 'DJ',
                    share: 0,
                })),
            }),
        ).shares,
        [33.34, 33.33, 33.33],
    );
    assert.deepEqual(
        calculateFeeAgreement(
            fee({
                fixed: 10.01,
                split: 'percent',
                participants: [
                    { name: 'Me', share: 60 },
                    { name: 'DJ', share: 40 },
                ],
            }),
        ).shares,
        [6.01, 4],
    );
    assert.equal(
        calculateFeeAgreement(
            fee({
                fixed: 0,
                entryPercent: 10,
                estimate: { tickets: 0, entries: 100.75, bar: 0 },
            }),
        ).owner,
        10.08,
    );
});
test('rejects incomplete terms, percentages, expenses and mismatched fixed splits', () => {
    assert.throws(() => validateFeeAgreement(emptyFeeAgreement()), /noTerms/);
    assert.throws(
        () => calculateFeeAgreement(fee({ entryPercent: 101 })),
        /invalid/,
    );
    assert.throws(
        () => calculateFeeAgreement(fee({ expenses: 101 })),
        /expensesTooHigh/,
    );
    assert.throws(
        () =>
            calculateFeeAgreement(
                fee({
                    split: 'percent',
                    participants: [{ name: 'Me', share: 99 }],
                }),
            ),
        /invalidSplit/,
    );
    assert.throws(
        () =>
            calculateFeeAgreement(
                fee({
                    split: 'fixed',
                    participants: [
                        { name: 'Me', share: 60 },
                        { name: 'DJ', share: 20 },
                    ],
                }),
            ),
        /invalidSplit/,
    );
    assert.deepEqual(
        calculateFeeAgreement(
            fee({
                split: 'fixed',
                participants: [
                    { name: 'Me', share: 60 },
                    { name: 'DJ', share: 40 },
                ],
            }),
        ).shares,
        [60, 40],
    );
});
test('zero actual revenue is allowed but forecasts never become income', () => {
    const a = fee({
        fixed: 0,
        entryPercent: 20,
        estimate: { tickets: 100, entries: 1000, bar: 0 },
    });
    assert.equal(calculateFeeAgreement(a).owner, 200);
    assert.equal(agreementAmount(a), 0);
    assert.equal(agreementAmount({ ...a, settled: true }), 0);
});
test('rejects malformed values, nonfinite amounts, fractional ticket counts and excessive precision', () => {
    for (const a of [
        fee({ fixed: NaN }),
        fee({ fixed: 1.001 }),
        fee({ estimate: { tickets: 1.5, entries: 0, bar: 0 } }),
        fee({ actual: {} }),
        fee({ timezone: 'invalid' }),
        fee({ participants: [] }),
    ])
        assert.throws(() => validateFeeAgreement(a), /invalid/);
});
