const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports, extra = {}) {
    const mod = { exports: {} };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
        { module: mod, exports: mod.exports, require: name => imports[name], process: { env: { EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN: 'phc_test' } }, ...extra });
    return mod.exports;
}
const privacy = load('src/analytics/privacy.ts', {});
function fixture() {
    let user = 'account-a';
    const choices = {};
    const instances = [];
    class Client {
        constructor(token, options) { this.options = options; this.events = []; instances.push(this); }
        identify() {}
        capture(event, properties) { const result = this.options.before_send({ event, properties }); if (result) this.events.push(result); }
        optOut() { this.stopped = true; return Promise.resolve(); }
        setPersistedProperty(key, value) { this.queue = value; }
        shutdown() { return Promise.resolve(); }
    }
    const api = load('src/analytics/index.ts', {
        'posthog-react-native': { __esModule: true, default: Client, PostHogPersistedProperty: { Queue: 'queue' } },
        'expo-crypto': { CryptoDigestAlgorithm: { SHA256: 'sha256' }, digestStringAsync: async (_, input) => require('node:crypto').createHash('sha256').update(input).digest('hex') },
        'react-native': { Platform: { OS: 'ios' } },
        '../store/useAuthStore': { useAuthStore: { getState: () => ({ session: user ? { user: { id: user } } : null }) } },
        './consent': { useAnalyticsConsent: { getState: () => ({ choices }) } }, './privacy': privacy,
    });
    return { api, choices, instances, setUser: value => { user = value; } };
}
test('unknown events and private fields are discarded', () => {
    assert.equal(privacy.safeProperties('$screen', { route: 'private' }), null);
    const p = privacy.safeProperties('audio_note_saved', { reminder_enabled: true, title: 'private', venue: 'Zoco', email: 'private', amount: 200 });
    assert.deepEqual(Object.keys(p), ['reminder_enabled']);
});
test('no SDK or events before consent; payload contains only pseudonymous identity and allowlisted fields', async () => {
    const f = fixture();
    await f.api.configureAnalytics('account-a', false);
    assert.equal(f.instances.length, 0);
    f.choices['account-a'] = true;
    await f.api.configureAnalytics('account-a', true);
    const sdk = f.instances[0];
    const event = sdk.options.before_send({ event: 'session_created', properties: { email: 'private', $set: { name: 'private' }, $current_url: '/session/private' }, $set: { name: 'private' } });
    assert.match(event.properties.distinct_id, /^[a-f0-9]{64}$/);
    assert(!JSON.stringify(event).includes('private'));
    assert.equal(sdk.options.captureAppLifecycleEvents, false);
    assert.equal(sdk.options.enableSessionReplay, false);
    assert.equal(sdk.options.disableRemoteConfig, true);
    assert.equal(sdk.options.host, 'https://eu.i.posthog.com');
});
test('withdrawal blocks capture immediately and account changes discard the previous queue', async () => {
    const f = fixture(); f.choices['account-a'] = true;
    await f.api.configureAnalytics('account-a', true);
    const first = f.instances[0]; const count = first.events.length;
    f.choices['account-a'] = false;
    f.api.captureAnalytics('session_created'); assert.equal(first.events.length, count);
    f.setUser('account-b'); f.choices['account-b'] = true;
    await f.api.configureAnalytics('account-b', true);
    assert.equal(first.stopped, true); assert.equal(first.queue.length, 0);
    const second = f.instances[1]; const nextCount = second.events.length;
    f.api.captureAnalytics('session_created', {}, 'account-a'); assert.equal(second.events.length, nextCount);
    assert.equal(first.options.before_send({ event: 'app_opened' }), null);
});
test('SDK capture failures never interrupt session operations', async () => {
    const f = fixture(); f.choices['account-a'] = true;
    await f.api.configureAnalytics('account-a', true);
    f.instances[0].capture = () => { throw Error('offline'); };
    assert.doesNotThrow(() => f.api.captureAnalytics('session_created'));
});

test('survey completion captures only the survey version, respects consent and rejects another account', async () => {
    const f = fixture();
    assert.equal(f.api.captureAnalytics('research_survey_submitted', { survey_version: 'self-employed-djs-v1' }), false);
    f.choices['account-a'] = true;
    await f.api.configureAnalytics('account-a', true);
    const sdk = f.instances[0];
    assert.equal(f.api.captureAnalytics('research_survey_submitted', { survey_version: 'self-employed-djs-v1', answers: { employment: 'private' }, email: 'private' }), true);
    const event = sdk.events.at(-1);
    assert.equal(event.event, 'research_survey_submitted');
    assert.equal(event.properties.survey_version, 'self-employed-djs-v1');
    assert(!JSON.stringify(event).includes('private'));
    const count = sdk.events.length;
    f.choices['account-a'] = false;
    assert.equal(f.api.captureAnalytics('research_survey_submitted'), false);
    f.choices['account-a'] = true;
    assert.equal(f.api.captureAnalytics('research_survey_submitted', {}, 'account-b'), false);
    assert.equal(sdk.events.length, count);
});
