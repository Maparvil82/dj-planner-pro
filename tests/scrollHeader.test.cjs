const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function setup(mode) {
    const visibility = [];
    let focus, stops = 0, hidden = false, previous = 0;
    const filename = path.resolve(__dirname, '../src/hooks/useScrollHeader.ts');
    const loaded = new Module(filename, module);
    loaded.require = request => request === 'react' ? { useCallback: fn => fn, useRef: value => ({ current: value }) }
        : request === 'expo-router' ? { useFocusEffect: fn => { focus = fn; } }
        : request === 'react-native-reanimated' ? {
            useSharedValue: value => ({ value }),
            cancelAnimation: () => { stops++; },
            withTiming: value => value,
            Easing: { quad: t => t ** 2, inOut: fn => fn },
        }
        : request.includes('TabBarVisibilityContext') ? { useTabBarScroll: () => ({ onScrollBeginDrag: () => {}, onScroll: event => { const y = Math.max(0, event.nativeEvent.contentOffset.y); const delta = y - previous; previous = y; if(delta) { hidden = delta > 0; visibility.push(hidden); } return delta; } }) } : require(request);
    loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
    const hook = loaded.exports.useScrollHeader(mode); focus();
    return { ...hook, focus, visibility, hidden: () => hidden, stops: () => stops };
}
const event = y => ({ nativeEvent: { contentOffset: { y } } });
for (const mode of ['compact', 'hide']) {
    test(`${mode} hides on the first downward pixel and reveals on the first upward pixel`, () => {
        const s = setup(mode);
        s.onScrollBeginDrag();
        s.onScroll(event(1)); assert.equal(s.progress.value, 1); assert.equal(s.hidden(), true);
        s.onScroll(event(100)); assert.equal(s.progress.value, 1);
        s.onScroll(event(99)); assert.equal(s.progress.value, 0); assert.equal(s.hidden(), false);
        s.onScroll(event(100)); assert.equal(s.progress.value, 1);
        s.onScroll(event(100)); assert.equal(s.progress.value, 1);
        s.onScroll(event(0)); assert.equal(s.progress.value, 0);
    });
    test(`${mode} restores the header when returning from another screen`, () => {
        const s = setup(mode);
        s.progress.value = 1;
        const stops = s.stops();
        s.focus();
        assert.equal(s.progress.value, 0);
        assert.equal(s.hidden(), false);
        assert.equal(s.stops(), stops + 1);
    });
}
