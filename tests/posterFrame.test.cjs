const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const moduleUnderTest = { exports: {} };
const compiled = ts.transpileModule(fs.readFileSync(require.resolve('../src/utils/posterFrame.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
new Function('module', 'exports', compiled)(moduleUnderTest, moduleUnderTest.exports);
const { posterCoverGeometry, dragPosterPosition, clampPosterPosition } = moduleUnderTest.exports;

test('portrait and landscape posters fill the card without distorting the image', () => {
    const portrait = posterCoverGeometry(310, 200, 900, 1200);
    assert.equal(portrait.width, 310);
    assert.equal(portrait.height > 200, true);
    assert.equal(portrait.overflowX, 0);
    assert.equal(portrait.width / portrait.height, 900 / 1200);
    const landscape = posterCoverGeometry(310, 200, 1600, 500);
    assert.equal(landscape.height, 200);
    assert.equal(landscape.width > 310, true);
    assert.equal(landscape.overflowY, 0);
});
test('dragging clamps to image edges and preserves the axis with no overflow', () => {
    assert.deepEqual(dragPosterPosition({ x: 0.5, y: 0.5 }, -999, -999, 0, 200), { x: 0.5, y: 1 });
    assert.deepEqual(dragPosterPosition({ x: 0.5, y: 0.5 }, 999, 999, 200, 0), { x: 0, y: 0.5 });
    assert.deepEqual(dragPosterPosition({ x: 0.5, y: 0.5 }, 0, -50, 0, 200), { x: 0.5, y: 0.75 });
});
test('invalid frame metadata falls back to the center and incomplete layouts wait for dimensions', () => {
    assert.equal(clampPosterPosition(NaN), 0.5);
    assert.equal(clampPosterPosition(undefined), 0.5);
    assert.equal(posterCoverGeometry(0, 200, 900, 1200), null);
    assert.equal(posterCoverGeometry(310, 200, 0, 1200), null);
});
