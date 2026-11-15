const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const mod = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/researchInvitation.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module: mod, exports: mod.exports });
const { eligibleForResearch: eligible } = mod.exports;
const now=Date.parse('2026-11-03T12:00:00Z'), old='2026-10-01T12:00:00Z';
test('automatic invitation requires seven days, completed work and updates acknowledged in an earlier visit', () => {
    assert(eligible({updatesVisit:'previous'},'current',old,true,now));
    assert(!eligible({updatesVisit:'current'},'current',old,true,now));
    assert(!eligible({},'current',old,true,now));
    assert(!eligible({updatesVisit:'previous'},'current','2026-11-01T00:00:00Z',true,now));
    assert(!eligible({updatesVisit:'previous'},'current',old,false,now));
    assert(!eligible({updatesVisit:'previous'},'current',undefined,true,now));
    assert(!eligible({updatesVisit:'previous'},'current','invalid',true,now));
});
test('dismissal and expressed interest both stop automatic repeats', () => {
    assert(!eligible({updatesVisit:'previous',shown:true},'current',old,true,now));
    assert(!eligible({updatesVisit:'previous',interested:true},'current',old,true,now));
});
test('visit tracking preserves an earlier acknowledgement and scopes choices by account', async () => {
    let now = Date.parse('2026-11-03T12:00:00Z'), onState;
    const stored = new Map();
    const service = { exports: {} };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/services/researchInvitation.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
        module: service, exports: service.exports,
        Date: { now: () => now }, Math, JSON,
        require: name => name.includes('async-storage') ? { __esModule: true, default: { getItem: async k => stored.get(k) || null, setItem: async (k,v) => { stored.set(k,v); } } } : { AppState: { addEventListener: (_, cb) => { onState = cb; return { remove() {} }; } } },
    });
    const s = service.exports;
    s.trackResearchVisits();
    await s.recordUpdatesVisit('a');
    const first = s.researchVisit();
    onState('background'); now += 31 * 60000; onState('active');
    assert.notEqual(s.researchVisit(), first);
    await s.recordUpdatesVisit('a');
    assert.equal((await s.readResearchInvitation('a')).updatesVisit, first);
    await s.changeResearchInvitation('a', p => ({...p,shown:true}));
    assert.equal((await s.readResearchInvitation('a')).shown,true);
    assert.equal((await s.readResearchInvitation('b')).shown,undefined);
    await s.recordUpdatesVisit('a',true);
    assert.equal((await s.readResearchInvitation('a')).updatesVisit,s.researchVisit());
});
