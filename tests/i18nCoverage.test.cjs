const { test } = require('node:test');
const assert = require('node:assert/strict');
const { audit, flatten } = require('../scripts/audit-i18n.cjs');
const i18next = require('i18next');

test('all configured languages translate every resource and static UI key with matching variables', () => {
    const result = audit();
    assert.equal(result.languages.length, 7);
    assert.deepEqual(result.errors, []);
});

test('each language renders Pro copy and UI actions without fallback or unresolved interpolation', async () => {
    const { languages } = audit();
    for (const language of languages) {
        const translation = require(`../src/i18n/languages/${language}.json`);
        const engine = i18next.createInstance();
        await engine.init({ lng: language, fallbackLng: false, resources: { [language]: { translation } } });
        for (const [key, value] of Object.entries(flatten(translation))) {
            const options = Object.fromEntries([...value.matchAll(/{{-?\s*([^},\s]+)(?:[^}]*)}}/g)].map(match => [match[1], match[1] === 'count' ? 2 : 'TEST']));
            assert.equal(engine.exists(key), true, `${language}: ${key}`);
            assert.ok(!engine.t(key, options).includes('{{'), `${language}: ${key}`);
        }
        for (const key of ['pro_benefits_title', 'proEducation.paidPlansHint', 'proDesign.featureLabel', 'retry', 'tickets.searchSession']) {
            if (language !== 'en') assert.notEqual(engine.t(key), flatten(require('../src/i18n/languages/en.json'))[key], `${language}: ${key}`);
        }
    }
});
