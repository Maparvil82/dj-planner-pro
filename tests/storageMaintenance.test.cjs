const test = require('node:test'),
    assert = require('node:assert/strict'),
    fs = require('node:fs'),
    ts = require('typescript'),
    vm = require('node:vm');
const mod = { exports: {} };
vm.runInNewContext(
    ts.transpileModule(
        fs.readFileSync(
            'supabase/functions/storage-maintenance/handler.ts',
            'utf8',
        ),
        {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2022,
            },
        },
    ).outputText,
    { exports: mod.exports, module: mod, Request, Response, Map },
);
const user = '00000000-0000-4000-8000-000000000001';
function fixture() {
    let completed = false,
        fail = false;
    const calls = [];
    const admin = {
        auth: {
            getUser: async (token) => ({
                data: { user: token === 'valid' ? { id: user } : null },
                error: null,
            }),
        },
        rpc: async (_, { action, target, items }) => {
            assert.equal(target, user);
            calls.push(action);
            if (action === 'ack') {
                assert.equal(items.length, 1);
                completed = true;
                return { data: {}, error: null };
            }
            return {
                data: {
                    objects: completed
                        ? []
                        : [{ bucket_id: 'avatars', name: user + '/old.jpg' }],
                },
                error: null,
            };
        },
        storage: {
            from: (bucket) => ({
                remove: async (paths) => {
                    assert.equal(bucket, 'avatars');
                    assert.equal(paths[0], user + '/old.jpg');
                    calls.push('remove');
                    return { error: fail ? { message: 'unavailable' } : null };
                },
            }),
        },
    };
    return {
        handler: mod.exports.createStorageMaintenanceHandler(admin),
        calls,
        fail: () => {
            fail = true;
        },
        recover: () => {
            fail = false;
        },
    };
}
const request = (token) =>
    new Request('https://example.invalid', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: JSON.stringify({ target: 'another-account' }),
    });
test('storage maintenance requires verified identity, ignores caller target and acknowledges only after Storage succeeds', async () => {
    const f = fixture();
    assert.equal((await f.handler(request())).status, 401);
    assert.equal((await f.handler(request('invalid'))).status, 401);
    assert.equal(f.calls.length, 0);
    const r = await f.handler(request('valid'));
    assert.equal(r.status, 200);
    assert.equal((await r.json()).removed, 1);
    assert.deepEqual(f.calls, ['claim', 'remove', 'ack']);
    await f.handler(request('valid'));
    assert.equal(f.calls.filter((x) => x === 'remove').length, 1);
});
test('storage failure keeps claim for a later retry', async () => {
    const f = fixture();
    f.fail();
    assert.equal((await f.handler(request('valid'))).status, 503);
    assert(!f.calls.includes('ack'));
    f.recover();
    assert.equal((await f.handler(request('valid'))).status, 200);
    assert(f.calls.includes('ack'));
});
