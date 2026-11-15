const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function setup() {
    const changes = [];
    let focus;
    const filename = path.resolve(__dirname, '../src/contexts/TabBarVisibilityContext.tsx');
    const loaded = new Module(filename, module);
    loaded.require = request => request === 'react' ? {
        createContext: () => ({}), useCallback: fn => fn,
        useContext: () => ({ setHidden: hidden => changes.push(hidden) }),
        useMemo: fn => fn(), useRef: value => ({ current: value }),
    } : request === 'expo-router' ? { useFocusEffect: fn => { focus = fn; } } : require(request);
    loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, filename);
    const { onScroll, onScrollBeginDrag } = loaded.exports.useTabBarScroll();
    const cleanup = focus();
    return { changes, onScroll, onScrollBeginDrag, focus, cleanup };
}
const event = (y, max = 1000) => ({ nativeEvent: {
    contentOffset: { y, x: 0 }, contentSize: { height: max + 800, width: 390 }, layoutMeasurement: { height: 800, width: 390 },
} });
test('navigation follows the first pixel in both scroll directions', t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const s = setup();
    s.onScroll(event(3)); assert.equal(s.changes.at(-1), true);
    s.onScroll(event(4)); assert.equal(s.changes.at(-1), true);
    s.onScroll(event(3)); assert.equal(s.changes.at(-1), false);
    s.cleanup();
});
test('navigation stays hidden when stopping, reaching the bottom and overscrolling', t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const s = setup();
    s.onScroll(event(100)); t.mock.timers.tick(5000);
    assert.equal(s.changes.at(-1), true);
    s.onScroll(event(100)); assert.equal(s.changes.at(-1), true);
    s.onScroll(event(1000)); assert.equal(s.changes.at(-1), true);
    s.onScroll(event(1030)); assert.equal(s.changes.at(-1), true);
    s.onScrollBeginDrag(); s.onScroll(event(999)); assert.equal(s.changes.at(-1), false);
    s.cleanup();
});
test('upward movement restores navigation at the top; unscrollable pages stay visible', () => {
    const s = setup();
    s.onScroll(event(100)); s.onScroll(event(-20));
    assert.equal(s.changes.at(-1), false);
    s.onScroll(event(0, 0)); assert.equal(s.changes.at(-1), false);
    s.cleanup();
});
test('leaving a screen ignores late scroll events; focus starts visible', t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const s = setup(); s.onScroll(event(100)); s.cleanup();
    const count = s.changes.length;
    t.mock.timers.tick(1000); s.onScroll(event(200)); assert.equal(s.changes.length, count);
    const cleanup = s.focus(); assert.equal(s.changes.at(-1), false);
    s.onScroll(event(3)); assert.equal(s.changes.at(-1), true);
    cleanup();
});


test('shrinking the viewport scroll range at the bottom is not an upward gesture', () => {
    const s = setup();
    s.onScroll(event(1000, 1000)); assert.equal(s.changes.at(-1), true);
    for (const max of [990, 980, 960, 952]) {
        s.onScroll(event(max, max)); assert.equal(s.changes.at(-1), true);
    }
    s.onScroll(event(1000, 952)); s.onScroll(event(952, 952));
    assert.equal(s.changes.at(-1), true, 'bounce back to the boundary stays hidden');
    s.onScrollBeginDrag(); s.onScroll(event(951, 952)); assert.equal(s.changes.at(-1), false);
    s.cleanup();
});

test('bottom rebound keeps navigation hidden', () => {
    const s = setup();
    for (const y of [200, 1000, 1020, 1050, 1010, 1000, 999.5, 1000]) {
        s.onScroll(event(y)); assert.equal(s.changes.at(-1), true);
    }
    s.onScrollBeginDrag(); s.onScroll(event(999));
    assert.equal(s.changes.at(-1), false);
    s.cleanup();
});
