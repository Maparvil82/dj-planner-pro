const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const exported = {};
new Function('exports', ts.transpileModule(fs.readFileSync('src/utils/paywallStage.ts','utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText)(exported);
const {paywallStage} = exported;

test('a single trial offer is available only before the trial starts', () => {
    const fresh = {status:'available',eligible:true};
    assert.equal(paywallStage(false,fresh,false),'intro');
    assert.equal(paywallStage(false,fresh,true),'plans');
    assert.equal(paywallStage(false,{status:'active',eligible:false},false),'active');
    assert.equal(paywallStage(false,{status:'active',eligible:false},true),'plans');
    for (const eligible of [true,false]) {
        assert.equal(paywallStage(false,{status:'expired',eligible},false),'plans');
        assert.equal(paywallStage(false,{status:'expired',eligible},true),'plans');
    }
});

test('subscribers never see trial activation or another purchase offer', () => {
    for (const trial of [null,{status:'available',eligible:true},{status:'active',eligible:false},{status:'expired',eligible:false}]) {
        for (const showPlans of [true,false]) assert.equal(paywallStage(true,trial,showPlans),'member');
    }
});

test('unavailable or unknown trial state cannot advertise an activation', () => {
    assert.equal(paywallStage(false,null,false),'plans');
    assert.equal(paywallStage(false,{status:'unavailable',eligible:false},false),'plans');
    assert.equal(paywallStage(false,{status:'available',eligible:false},false),'plans');
});
