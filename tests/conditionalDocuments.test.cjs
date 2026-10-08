const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const i18next = require('i18next');
require.extensions['.ts'] = (m, filename) =>
    m._compile(
        ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2022,
            },
        }).outputText,
        filename,
    );
const { emptyConditionalAgreement } = require('../src/utils/feeAgreement.ts');
const {
    conditionalBreakdown,
} = require('../src/utils/conditionalBreakdown.ts');
const { buildAgreementHtml } = require('../src/utils/agreementDocument.ts');
const plan = () => ({
    ...emptyConditionalAgreement(),
    ticketMode: 'dj_fixed',
    ticketValue: 5,
    tickets: [
        {
            name: 'General',
            price: 10,
            estimate: 100,
            sold: 100,
            refunded: 0,
            invited: 0,
        },
        {
            name: 'Anticipada',
            price: 5,
            estimate: 50,
            sold: 50,
            refunded: 0,
            invited: 0,
        },
    ],
});
const amount = (b, key) =>
    [...b.boxOffice, ...b.pool].find((row) => row.key === key)?.amount;
test('1250 in ticket sales reconciles to 500 for venue and 750 for DJs, without inventing expenses', () => {
    const b = conditionalBreakdown(plan(), false);
    assert.equal(amount(b, 'gross'), 1250);
    assert.equal(amount(b, 'remainder'), 500);
    assert.equal(amount(b, 'ticketShare'), 750);
    assert.equal(amount(b, 'expenses'), 0);
    assert.equal(amount(b, 'pool'), 750);
    assert.equal(b.result.owner, 750);
});
test('net ticket and bar bases, itemized costs, guarantees and DJ splits reconcile independently', () => {
    const a = plan();
    a.ticketMode = 'percent';
    a.ticketValue = 60;
    a.ticketBasis = 'net';
    a.barPercent = 10;
    a.barBasis = 'net';
    a.estimate = {
        ticketDeductions: 50,
        bar: 1000,
        barDeductions: 100,
        expenses: 10,
    };
    a.expenseItems = [
        { concept: 'Transporte', type: 'fixed', value: 20 },
        { concept: 'Agencia', type: 'percent', value: 10 },
    ];
    a.participants = [
        { name: '', share: 0 },
        { name: 'Pepe', share: 0 },
    ];
    const b = conditionalBreakdown(a, false);
    assert.equal(amount(b, 'remainder'), 480);
    assert.equal(amount(b, 'ticketShare'), 720);
    assert.equal(amount(b, 'barRemainder'), 810);
    assert.equal(amount(b, 'barShare'), 90);
    assert.equal(b.result.expenses, 111);
    assert.equal(b.result.total, 699);
    assert.deepEqual(b.result.shares, [349.5, 349.5]);
    a.fixed = 900;
    a.fixedMode = 'versus';
    const guarantee = conditionalBreakdown(a, false);
    assert.equal(amount(guarantee, 'fixedTopUp'), 201);
    assert.equal(guarantee.result.total, 900);
});
test('fixed ticket fees exceeding revenue show required funding, not negative venue profit', () => {
    const a = plan();
    a.ticketValue = 10;
    const b = conditionalBreakdown(a, false);
    assert.equal(amount(b, 'ticketTopUp'), 250);
    assert.equal(amount(b, 'remainder'), undefined);
});
test('agreement document has terms and signature blanks, escapes content, excludes forecast sales and resolves every language', async () => {
    const resources = Object.fromEntries(
        fs
            .readdirSync('src/i18n/languages')
            .filter((x) => x.endsWith('.json'))
            .map((file) => [
                file.replace('.json', ''),
                {
                    translation: JSON.parse(
                        fs.readFileSync('src/i18n/languages/' + file),
                    ),
                },
            ]),
    );
    const i = i18next.createInstance();
    await i.init({
        lng: 'es',
        resources,
        interpolation: { escapeValue: false },
    });
    const a = plan();
    a.notes = '<script>alert(1)</script>';
    a.expenseItems = [{ concept: 'Transporte', type: 'fixed', value: 20 }];
    const session = {
        id: 'fixture-contract',
        title: 'Soul night',
        date: '2026-10-10',
        venue: 'Sala X',
        start_time: '22:00',
        end_time: '04:00',
        updated_at: '2026-10-08T10:00:00Z',
        currency: '€',
        fee_agreement: a,
    };
    for (const language of Object.keys(resources)) {
        const html = buildAgreementHtml(
            session,
            'DJ Demo',
            language,
            i.getFixedT(language),
        );
        assert.ok(!html.includes('<script>'));
        assert.ok(html.includes('&lt;script&gt;'));
        assert.ok(
            !html.includes('1.250') &&
                !html.includes('1,250') &&
                !html.includes('1250'),
        );
        assert.ok(!/conditional[A-Za-z]*\.|agreementPdf\./.test(html));
        assert.ok(
            html.includes('DJ Demo') &&
                html.includes('Sala X') &&
                html.includes('fixture-contract'),
        );
        if (language === 'es')
            fs.writeFileSync(
                '/private/tmp/djplanner-agreement-preview.html',
                html,
            );
    }
    a.settled = true;
    const settled = buildAgreementHtml(
        session,
        'DJ Demo',
        'es',
        i.getFixedT('es'),
    );
    assert.ok(
        settled.includes('Liquidación registrada') &&
            settled.includes('1250,00'),
    );
});
