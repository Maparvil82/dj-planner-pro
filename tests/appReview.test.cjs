const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
function load() {
    const data = new Map();
    let requests = 0;
    const m = new Module(__filename, module);
    m.require = name => {
        if (name === '@react-native-async-storage/async-storage') return { __esModule: true, default: {
            getItem: async key => data.get(key) || null,
            setItem: async (key, value) => { data.set(key, value); },
        }};
        if (name === 'react-native') return { Platform: { OS: 'ios' } };
        if (name === 'expo-store-review') return { isAvailableAsync: async () => true, requestReview: async () => { requests++; } };
        return require(name);
    };
    m._compile(ts.transpileModule(fs.readFileSync('src/services/appReview.ts', 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText, __filename);
    return { ...m.exports, data, requests: () => requests };
}
const DAY = 86400000;
test('requires meaningful use, recent save and cooldown; never prompts merely on launch', () => {
    const { reviewEligible } = load();
    const now = Date.now();
    const ready = { firstSeen: now - 8 * DAY, days: ['a', 'b', 'c'], lastSave: now - 2000, lastRequest: 0 };
    assert.equal(reviewEligible(ready, 2, now), true);
    for (const patch of [{firstSeen: now - DAY}, {days: ['a']}, {lastSave: 0}, {lastSave: now - 61000}, {lastRequest: now - DAY}]) {
        assert.equal(reviewEligible({...ready, ...patch}, 2, now), false);
    }
    assert.equal(reviewEligible(ready, 1, now), false);
    assert.equal(reviewEligible({...ready, lastRequest: now - 121 * DAY}, 2, now), true);
});
test('deduplicates days, isolates accounts, cancels unsafe requests and persists one attempt', async () => {
    const api = load();
    await Promise.all([api.recordReviewUse('a'), api.recordReviewUse('a', true)]);
    assert.equal(JSON.parse(api.data.get('app-review-v1:a')).days.length, 1);
    assert.equal(api.data.has('app-review-v1:b'), false);
    api.data.set('app-review-v1:a', JSON.stringify({firstSeen: Date.now() - 8 * DAY, days:['a','b','c'], lastSave: Date.now(), lastRequest:0}));
    await api.requestReviewIfEligible('a', 2, () => false);
    assert.equal(api.requests(), 0);
    await Promise.all([api.requestReviewIfEligible('a', 2, () => true), api.requestReviewIfEligible('a', 2, () => true)]);
    assert.equal(api.requests(), 1);
    assert.ok(JSON.parse(api.data.get('app-review-v1:a')).lastRequest);
});
