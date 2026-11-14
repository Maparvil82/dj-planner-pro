const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const money = {};
new Function('exports', ts.transpileModule(fs.readFileSync('src/i18n/money.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(money);
const { formatMoney, moneyCurrencyCode, regionalNumberLocale, regionalCurrency } = money;

test('prices use the currency symbol, placement, separators and fraction digits of each region', () => {
    const fixtures = [
        ['es-ES', 'EUR', '12.345,67', '€'], ['en-US', 'USD', '12,345.67', '$'],
        ['en-GB', 'GBP', '12,345.67', '£'], ['de-DE', 'EUR', '12.345,67', '€'],
        ['fr-FR', 'EUR', '12\u202f345,67', '€'], ['it-IT', 'EUR', '12.345,67', '€'],
        ['pt-PT', 'EUR', '12\u00a0345,67', '€'], ['pt-BR', 'BRL', '12.345,67', 'R$'],
        ['ja-JP', 'JPY', '12,346', '￥'],
    ];
    for (const [locale, currency, value, symbol] of fixtures) {
        const formatted = formatMoney(12345.67, currency, locale);
        assert.ok(formatted.includes(value), `${locale}: ${formatted}`);
        assert.ok(formatted.includes(symbol), `${locale}: ${formatted}`);
    }
    assert.equal(formatMoney(4.99, 'USD', 'en-US'), '$4.99');
    assert.equal(formatMoney(4.99, 'GBP', 'en-GB'), '£4.99');
    assert.equal(formatMoney(4.99, 'EUR', 'es-ES'), '4,99\u00a0€');
    assert.equal(formatMoney(4.99, 'EUR', 'de-CH'), 'EUR\u00a04.99');
    assert.equal(formatMoney(1.234, 'KWD', 'en-US'), 'KWD\u00a01.234');
});

test('a UI language change cannot change the amount, currency or regional conventions', () => {
    assert.equal(regionalNumberLocale('pt-BR', 'BR'), 'pt-BR');
    assert.equal(regionalNumberLocale('en-US', 'GB'), 'en-GB');
    assert.equal(regionalNumberLocale('invalid_locale', 'US'), 'en-US');
    for (const [symbol, code] of [['€', 'EUR'], ['$', 'USD'], ['£', 'GBP'], ['¥', 'JPY'], [' eur ', 'EUR']]) {
        assert.equal(moneyCurrencyCode(symbol), code);
        assert.equal(formatMoney(14.99, symbol, 'en-US'), formatMoney(14.99, code, 'en-US'));
    }
    assert.equal(formatMoney(-12.5, 'USD', 'en-US'), '-$12.50');
    assert.equal(formatMoney(0, 'JPY', 'ja-JP'), '￥0');
    assert.equal(formatMoney(12.5, 'old-currency', 'en-US'), '12.5 old-currency');
});

test('new-session currency comes from native settings or an explicit web region', () => {
    assert.equal(regionalCurrency('CAD', 'US'), 'CAD');
    for (const [region, currency] of [['ES', 'EUR'], ['US', 'USD'], ['GB', 'GBP'], ['JP', 'JPY'], ['BR', 'BRL'], ['CH', 'CHF']]) {
        assert.equal(regionalCurrency(null, region), currency);
    }
});
