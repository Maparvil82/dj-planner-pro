const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const moduleUnderTest = { exports: {} };
const compiled = ts.transpileModule(fs.readFileSync(require.resolve('../src/utils/communityLinks.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
new Function('module', 'exports', compiled)(moduleUnderTest, moduleUnderTest.exports);
const { normalizeDJLink } = moduleUnderTest.exports;

test('DJ links accept optional empty values and canonical HTTPS platform profiles', () => {
    assert.equal(normalizeDJLink(' ', 'instagram'), '');
    assert.equal(normalizeDJLink(' soundcloud.com/dj-demo ', 'soundcloud'), 'https://soundcloud.com/dj-demo');
    assert.equal(normalizeDJLink('https://www.mixcloud.com/dj-demo/', 'mixcloud'), 'https://www.mixcloud.com/dj-demo/');
});
test('DJ links reject executable schemes, credentials, misleading hosts and unrelated platforms', () => {
    for (const value of ['javascript:alert(1)', 'http://instagram.com/demo', 'https://instagram.com.evil.test/demo', 'https://instagram.com@evil.test/demo', 'https://evil.test@instagram.com/demo', 'https://instagram.com:8443/demo', 'https://mixcloud.com/demo', 'https://instagram.com/a b', 'https://instagram.com/'+ 'a'.repeat(500)]) assert.throws(() => normalizeDJLink(value, 'instagram'), value);
});
