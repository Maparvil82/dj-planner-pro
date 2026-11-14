const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const prices = require('../src/config/annualStorePrices.json');
const storefronts = require('../src/config/appleStorefronts.json');
const exported = {};
const source = ts.transpileModule(fs.readFileSync('src/config/annualCampaign.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
new Function('exports', 'require', source)(exported, name => {
    if (name === './annualStorePrices.json') return prices;
    if (name === './appleStorefronts.json') return storefronts;
    throw new Error(`Unexpected import ${name}`);
});
const { annualCampaignPrice } = exported;

test('all 175 Apple territories have positive verified prices and alpha-2/alpha-3 parity', () => {
    assert.equal(Object.keys(prices).length, 175);
    assert.equal(new Set(Object.values(storefronts)).size, 175);
    for (const [alpha2, alpha3] of Object.entries(storefronts)) {
        const before = annualCampaignPrice(alpha2, null, new Date(2026, 10, 4));
        const finalDay = annualCampaignPrice(alpha3, null, new Date(2027, 0, 6, 23, 59, 59));
        const after = annualCampaignPrice(alpha3, null, new Date(2027, 0, 7));
        assert.deepEqual(before, finalDay);
        assert.equal(before.price, prices[alpha3].promotion);
        assert.equal(after.price, prices[alpha3].standard);
        assert.equal(before.currency, after.currency);
        assert.equal(before.promotion, true);
        assert.equal(after.promotion, false);
        assert.ok(before.price > 0 && after.price >= before.price);
        assert.doesNotThrow(() => new Intl.NumberFormat('es', {style:'currency',currency:after.currency}).format(after.price));
    }
});

test('Apple storefront wins over device country; currency alone never determines the equivalent', () => {
    const now = new Date(2026, 10, 4);
    assert.deepEqual(annualCampaignPrice('USA', 'ES', now), { currency: 'USD', price: 14.99, standard: 24.99, promotion: true });
    assert.deepEqual(annualCampaignPrice('ALB', 'US', now), { currency: 'USD', price: 17.99, standard: 29.99, promotion: true });
    assert.deepEqual(annualCampaignPrice('JPN', 'ES', now), { currency: 'JPY', price: 2500, standard: 4000, promotion: true });
    assert.deepEqual(annualCampaignPrice(null, 'es', now), { currency: 'EUR', price: 15.99, standard: 29.99, promotion: true });
    assert.equal(annualCampaignPrice('ZZZ', 'ES', now), null);
    assert.equal(annualCampaignPrice(null, null, now), null);
});
