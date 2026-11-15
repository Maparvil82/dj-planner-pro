const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const moduleUnderTest = { exports: {} };
const compiled = ts.transpileModule(fs.readFileSync(require.resolve('../src/utils/musicGenres.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
new Function('module', 'exports', compiled)(moduleUnderTest, moduleUnderTest.exports);
const { parseMusicGenres, serializeMusicGenres, suggestMusicGenres } = moduleUnderTest.exports;

test('music genres deduplicate spelling variants and aliases into canonical names', () => {
    assert.deepEqual(parseMusicGenres('house, HOUSE · HAuse; dnb | Drum & Bass'), ['House', 'Drum & Bass']);
    assert.equal(serializeMusicGenres([' house ', 'House', 'reggaetón']), 'House · Reggaeton');
});
test('genre search handles misspellings and excludes already selected genres', () => {
    assert.equal(suggestMusicGenres('hause')[0], 'House');
    assert.equal(suggestMusicGenres('tehcno')[0], 'Techno');
    assert.equal(suggestMusicGenres('house', ['House']).includes('House'), false);
});
test('existing custom styles remain available without creating new catalogue entries', () => {
    assert.deepEqual(parseMusicGenres('My old style · house'), ['My old style', 'House']);
    assert.deepEqual(suggestMusicGenres('zzzzz'), []);
});
