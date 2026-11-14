const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/hooks/usePosterPreviewAccess.ts');
function access(user, serverAllowed = false, failed = false) {
    const loaded = new Module(filename, module);
    loaded.require = id => id.includes('useAuthStore') ? ({ useAuthStore: select => select({ session: user ? { user } : null }) }) : id === '@tanstack/react-query' ? ({useQuery: options => {
        assert.deepEqual(options.queryKey, ['poster-access',user?.id]);
        assert.equal(options.enabled, !!user?.email_confirmed_at);
        return {data:failed?undefined:serverAllowed,isFetching:false};
    }}) : ({supabase:{rpc:()=>{throw Error('Query execution tested at the database');}}});
    loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText, filename);
    return loaded.exports.usePosterPreviewAccess();
}
test('poster generation access is gated by the server and current confirmed identity, never a client email flag', () => {
    const owner = { id: 'd5d17646-f273-4fda-b094-ea8a97cb3ad1', email: 'maparvil@gmail.com', email_confirmed_at: '2026-01-01' };
    assert.equal(access(owner,true).data, true);
    assert.equal(access(owner,false).data, false);
    assert.equal(access(owner,true,true).data, false);
    assert.equal(access({...owner,id:'invited-account',email:'other@gmail.com'},true).data,true);
    for (const user of [null, { ...owner, email_confirmed_at: null }]) {
        assert.equal(access(user).data, false);
    }
});
