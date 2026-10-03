const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const originalExtension = require.extensions['.ts'];
const originalLoad = Module._load;
let usage, verified, syncCalls, creates, rpcError;
const client = {
    rpc: () => ({
        single: async () => {
            creates++;
            return { data: { id: 'created' }, error: rpcError };
        },
    }),
};
Module._load = function (request, parent, main) {
    if (request === 'react-native') return { Platform: { OS: 'web' } };
    if (request === '../lib/supabase') return { supabase: client };
    if (request === './collaborations')
        return { collaborationService: { agenda: async () => [] } };
    if (request === './subscriptionAccess')
        return {
            getSessionUsage: async () => usage,
            syncSubscriptionAccess: async () => {
                syncCalls++;
                if (verified instanceof Error) throw verified;
                return verified;
            },
        };
    return originalLoad.call(this, request, parent, main);
};
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
const { sessionService } = require('../src/services/sessions.ts');
const { SessionLimitError } = require('../src/utils/sessionLimit.ts');
Module._load = originalLoad;
if (originalExtension) require.extensions['.ts'] = originalExtension;
else delete require.extensions['.ts'];
sessionService.syncTags = async () => {};
const input = {
    title: 'Night',
    venue: 'Club',
    date: '2027-01-01',
    start_time: '22:00',
    end_time: '04:00',
    earning_type: 'free',
    earning_amount: 0,
};
function reset(count = 29) {
    usage = {
        count,
        limit: 30,
        remaining: Math.max(0, 30 - count),
        isPro: false,
    };
    verified = usage;
    syncCalls = 0;
    creates = 0;
    rpcError = null;
}
test('30th creation stays free without requiring RevenueCat availability', async () => {
    reset();
    await sessionService.createSession(input, 'owner');
    assert.equal(creates, 1);
    assert.equal(syncCalls, 0);
});
test('31st free session triggers paywall error without creating any record', async () => {
    reset(30);
    await assert.rejects(
        () => sessionService.createSession(input, 'owner'),
        (e) =>
            e instanceof SessionLimitError &&
            e.requested === 1 &&
            e.usage.count === 30,
    );
    assert.equal(syncCalls, 1);
    assert.equal(creates, 0);
});
test('full recurring series is checked, and an exact fit is allowed', async () => {
    reset(28);
    const recurring = {
        ...input,
        recurrence_type: 'daily',
        recurrence_end_date: '2027-01-03',
    };
    await assert.rejects(
        () => sessionService.createSession(recurring, 'owner'),
        (e) => e instanceof SessionLimitError && e.requested === 3,
    );
    assert.equal(creates, 0);
    reset(27);
    await sessionService.createSession(recurring, 'owner');
    assert.equal(creates, 1);
    assert.equal(syncCalls, 0);
});
test('verified paid account can create above quota across devices', async () => {
    reset(50);
    verified = { ...usage, isPro: true };
    await sessionService.createSession(input, 'owner');
    assert.equal(syncCalls, 1);
    assert.equal(creates, 1);
});
test('subscription outages cause retryable errors without downgrading or saving', async () => {
    reset(30);
    verified = new Error('billing.verificationError');
    await assert.rejects(
        () => sessionService.createSession(input, 'owner'),
        /billing.verificationError/,
    );
    assert.equal(creates, 0);
});
test('server race that consumes the final slot still returns the quota error', async () => {
    reset(29);
    rpcError = { message: 'session_limit_reached' };
    await assert.rejects(
        () => sessionService.createSession(input, 'owner'),
        (e) => e instanceof SessionLimitError,
    );
    assert.equal(creates, 1);
});
