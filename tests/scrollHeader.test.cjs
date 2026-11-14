const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Decisión de producto (noviembre de 2026): los encabezados se quedan fijos.
// La animación al desplazarse no era fluida y confundía. Ver docs/encabezados-scroll.md.
function setup(mode) {
    const filename = path.resolve(__dirname, '../src/hooks/useScrollHeader.ts');
    const loaded = new Module(filename, module);
    loaded.require = request => request === 'react' ? { useCallback: fn => fn }
        : request === 'react-native-reanimated' ? { useSharedValue: value => ({ value }) }
        : require(request);
    loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
    return loaded.exports.useScrollHeader(mode);
}
const event = y => ({ nativeEvent: { contentOffset: { y }, contentSize: { height: 2000 }, layoutMeasurement: { height: 800 } } });

for (const mode of ['compact', 'hide']) {
    test(`${mode} keeps the header expanded while scrolling in both directions`, () => {
        const s = setup(mode);
        assert.equal(s.progress.value, 0);
        s.onScrollBeginDrag();
        for (const y of [1, 100, 99, 600, 1200, 0]) {
            s.onScroll(event(y));
            assert.equal(s.progress.value, 0, `progress changed at y=${y}`);
        }
    });

    test(`${mode} keeps the scroll interface used by screens`, () => {
        const s = setup(mode);
        assert.equal(typeof s.onScroll, 'function');
        assert.equal(typeof s.onScrollBeginDrag, 'function');
        assert.ok('value' in s.progress);
    });
}
