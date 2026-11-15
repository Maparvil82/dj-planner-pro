const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function setup() {
    let params = {}, chosen = '';
    const calls = [], row = { id: 'current' };
    const filename = path.resolve(__dirname, '../src/hooks/useSessionToolContext.ts');
    const loaded = new Module(filename, module);
    const result = data => ({ data, isLoading: false, isPending: false, isError: false, refetch: async () => {} });
    loaded.require = request => request === 'react' ? { useState: () => [chosen, value => { chosen = value; }] }
        : request === 'expo-router' ? { useLocalSearchParams: () => params }
        : request === './useSessionsQuery' ? {
            useAllSessionsQuery: enabled => { calls.push(['all', enabled]); return result([{ id: 'other' }]); },
            useSessionByIdQuery: id => { calls.push(['direct', id]); return result(id === row.id ? row : null); },
        } : require(request);
    loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
    return { render: () => loaded.exports.useSessionToolContext(), params: value => { params = value; }, calls };
}
test('a prefetched chooser reacts to a session parameter arriving later', () => {
    const s = setup(); assert.equal(s.render().sessionId, '');
    s.params({ sessionId: 'current' }); const bound = s.render();
    assert.equal(bound.sessionId, 'current'); assert.equal(bound.isSessionBound, true);
    assert.deepEqual(bound.sessions.data, [{ id: 'current' }]);
    assert.deepEqual(s.calls.slice(-2), [['all', false], ['direct', 'current']]);
});
test('global entry keeps selection; a route parameter always overrides the chosen session', () => {
    const s = setup(); s.render().setSessionId('other');
    assert.equal(s.render().sessionId, 'other'); assert.equal(s.render().isSessionBound, false);
    s.params({ sessionId: ['current'] }); assert.equal(s.render().sessionId, 'current');
});
test('an invalid session parameter cannot silently fall back to another session or the chooser', () => {
    const s = setup(); s.params({ sessionId: 'missing' }); const context = s.render();
    assert.equal(context.isSessionBound, true); assert.equal(context.sessionId, 'missing');
    assert.deepEqual(context.sessions.data, []);
    assert.deepEqual(s.calls, [['all', false], ['direct', 'missing']]);
});
