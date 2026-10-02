const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const original = require.extensions['.ts'];
require.extensions['.ts'] = (m, filename) => m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText, filename);
const { sessionPhase, validSessionDate, parseSessionAmount, validateSessionInput, relatedSessionTargets } = require('../src/utils/sessionWorkflow.ts');
if (original) require.extensions['.ts'] = original; else delete require.extensions['.ts'];
const session = (overrides = {}) => ({id: 'root', user_id: 'owner', title: 'Night', venue: 'Club', date: '2026-10-02', start_time: '22:00', end_time: '04:00', earning_type: 'fixed', earning_amount: 250, status: 'confirmed', ...overrides});
test('confirmed booking phase follows overnight start and end boundaries', () => {
    assert.equal(sessionPhase(session(), new Date(2026,9,2,21,59)), 'confirmed');
    assert.equal(sessionPhase(session(), new Date(2026,9,2,22)), 'ongoing');
    assert.equal(sessionPhase(session(), new Date(2026,9,3,3,59)), 'ongoing');
    assert.equal(sessionPhase(session(), new Date(2026,9,3,4)), 'finished');
});
test('legacy pending sessions follow time while cancellation remains explicit', () => {
    assert.equal(sessionPhase(session({status:'pending'}),new Date(2026,10,1)),'finished');
    assert.equal(sessionPhase(session({status:'cancelled'}),new Date(2026,10,1)),'cancelled');
});
test('date validation rejects impossible dates and accepts leap days', () => {
    assert.equal(validSessionDate('2024-02-29'),true);
    for(const date of ['2026-02-29','2026-02-30','2026-13-01','2026-2-01','2026-10-00']) assert.equal(validSessionDate(date),false);
});
test('paid fees accept decimal commas and reject ambiguous or nonpositive amounts', () => {
    assert.equal(parseSessionAmount(' 250,50 ','hourly'),250.5);
    assert.equal(parseSessionAmount('garbage','free'),0);
    for(const amount of ['0','-1','1e3','0xff','12.345','Infinity','1,200.00','1000000000']) assert.throws(()=>parseSessionAmount(amount,'fixed'));
});
test('create validation trims names, defaults active, clears inactive DJ selections and free fees', () => {
    const result=validateSessionInput(session({title:' Night ',venue:' Club ',status:undefined,is_collective:false,djs:['Old DJ'],earning_type:'free',earning_amount:50}));
    assert.equal(result.status,'confirmed');assert.equal(result.title,'Night');assert.deepEqual(result.djs,[]);assert.equal(result.earning_amount,0);
});
test('invalid schedules and empty collective sessions are rejected before saving', () => {
    assert.throws(()=>validateSessionInput(session({end_time:'22:00'})),/equalTimes/);
    assert.throws(()=>validateSessionInput(session({start_time:'24:00'})),/invalidTime/);
    assert.throws(()=>validateSessionInput(session({is_collective:true,djs:[' ']})),/missingDjs/);
    assert.deepEqual(validateSessionInput(session({is_collective:true,djs:[' DJ A ','DJ A','DJ B']})).djs,['DJ A','DJ B']);
});
test('series edits target only current and following occurrences, never matching titles', () => {
    const root=session(), earlier=session({id:'earlier',date:'2026-09-01',parent_session_id:'root'}), current=session({id:'child',date:'2026-10-09',parent_session_id:'root'}), following=session({id:'later',date:'2026-10-16',parent_session_id:'root'}), independent=session({id:'independent',date:'2026-10-16'});
    const all=[root,earlier,current,following,independent];
    assert.deepEqual(relatedSessionTargets(all,current,true).map(s=>s.id),['child','later']);
    assert.deepEqual(relatedSessionTargets(all,current,false).map(s=>s.id),['child']);
    assert.deepEqual(relatedSessionTargets(all,independent,true).map(s=>s.id),['independent']);
});
