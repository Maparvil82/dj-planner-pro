const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
    ts = require('typescript'),
    Module = require('node:module'),
    path = require('node:path');
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
    emptyConditionalAgreement,
    calculateConditionalAgreement,
    validateConditionalAgreement,
    agreementAmount,
} = m.exports;
const plan = (changes = {}) => ({
    ...emptyConditionalAgreement(),
    tickets: [
        {
            name: 'General',
            price: 10,
            estimate: 100,
            sold: 100,
            refunded: 0,
            invited: 20,
        },
    ],
    ...changes,
});
const calc = (a, actual = true) => calculateConditionalAgreement(a, actual);
test('10 euro ticket leaves 3 to venue and 7 to DJs; guests and full refunds excluded', () => {
    const a = plan();
    assert.equal(calc(a).owner, 700);
    assert.equal(calc(a).venueRetention, 300);
    a.tickets[0].refunded = 10;
    assert.equal(calc(a).owner, 630);
    assert.equal(calc(a).paidTickets, 90);
    assert.equal(agreementAmount(a), 0);
    a.settled = true;
    assert.equal(agreementAmount(a), 630);
});
test('different ticket prices, net deductions, bar and per-ticket fee do not duplicate revenue', () => {
    const a = plan({
        ticketMode: 'percent',
        ticketValue: 70,
        ticketBasis: 'net',
        barPercent: 10,
        barBasis: 'net',
        tickets: [
            {
                name: 'Early',
                price: 10,
                estimate: 30,
                sold: 30,
                refunded: 5,
                invited: 0,
            },
            {
                name: 'Door',
                price: 15,
                estimate: 20,
                sold: 20,
                refunded: 0,
                invited: 0,
            },
        ],
        actual: {
            ticketDeductions: 50,
            bar: 1000,
            barDeductions: 100,
            expenses: 0,
        },
    });
    assert.equal(calc(a).ticketGross, 550);
    assert.equal(calc(a).tickets, 350);
    assert.equal(calc(a).bar, 90);
    assert.equal(calc(a).owner, 440);
    a.ticketMode = 'dj_fixed';
    a.ticketValue = 7;
    assert.equal(calc(a).tickets, 315);
});
test('fixed plus variable differs from versus, costs before guarantees, bonus and ceiling', () => {
    let a = plan({
        fixed: 300,
        minimum: 400,
        maximum: 1000,
        bonusThreshold: 100,
        bonusAmount: 100,
        actual: { ticketDeductions: 0, bar: 0, barDeductions: 0, expenses: 50 },
    });
    assert.equal(calc(a).owner, 1000);
    a.fixedMode = 'versus';
    assert.equal(calc(a).owner, 750);
    a.tickets[0].sold = 0;
    assert.equal(calc(a).owner, 400);
});
test('largest remainder allocation conserves cents and never gives money to zero percent', () => {
    const a = plan({
        ticketMode: 'dj_fixed',
        ticketValue: 0.01,
        tickets: [
            {
                name: 'One',
                price: 1,
                estimate: 1,
                sold: 1,
                refunded: 0,
                invited: 0,
            },
        ],
        split: 'percent',
        participants: [
            { name: 'Owner', share: 0 },
            { name: 'Other', share: 100 },
        ],
    });
    assert.deepEqual(calc(a).shares, [0, 0.01]);
    a.split = 'equal';
    a.participants = [
        { name: 'Me', share: 0 },
        { name: 'B', share: 0 },
        { name: 'C', share: 0 },
    ];
    assert.deepEqual(calc(a).shares, [0.01, 0, 0]);
});
test('fixed payouts to other DJs leave the exact remainder to owner', () => {
    const a = plan({
        split: 'fixed',
        participants: [
            { name: 'Owner', share: 999 },
            { name: 'Guest', share: 200 },
        ],
    });
    assert.deepEqual(calc(a).shares, [500, 200]);
    a.participants[1].share = 701;
    assert.throws(() => calc(a), /invalidSplit/);
});
test('rejects invalid terms, impossible refunds, deductions, percentages and overflows', () => {
    const a = plan();
    a.tickets[0].refunded = 101;
    assert.throws(() => calc(a), /invalidTickets/);
    assert.throws(() => calc(plan({ ticketValue: 11 })), /invalidTickets/);
    assert.throws(() => calc(plan({ barPercent: 101 })), /invalid/);
    assert.throws(() => calc(plan({ minimum: 400, maximum: 399 })), /invalid/);
    assert.throws(
        () =>
            calc(
                plan({
                    actual: {
                        ticketDeductions: 1001,
                        bar: 0,
                        barDeductions: 0,
                        expenses: 0,
                    },
                }),
            ),
        /deductionsTooHigh/,
    );
    assert.throws(
        () =>
            validateConditionalAgreement(
                plan({ bonusThreshold: 0, bonusAmount: 1 }),
            ),
        /invalid/,
    );
    assert.throws(
        () =>
            calc(
                plan({
                    tickets: [
                        {
                            name: 'Big',
                            price: 999999999,
                            estimate: 1000000,
                            sold: 1000000,
                            refunded: 0,
                            invited: 0,
                        },
                    ],
                }),
            ),
        /invalid/,
    );
});
module.exports = { plan, calc };
