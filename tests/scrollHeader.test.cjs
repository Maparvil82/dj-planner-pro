const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function setup(mode) {
    const timings = [], scrolls = [];
    let focus, stops = 0;
    class Value { constructor(value) { this.value = value; } setValue(value) { this.value = value; } }
    const filename = path.resolve(__dirname, '../src/hooks/useScrollHeader.ts');
    const loaded = new Module(filename, module);
    loaded.require = request => request === 'react' ? { useCallback: fn => fn, useRef: value => ({ current: value }) }
        : request === 'expo-router' ? { useFocusEffect: fn => { focus = fn; } }
        : request === 'react-native-reanimated' ? {
            useSharedValue: value => ({ value }),
            cancelAnimation: () => { stops++; },
            withTiming: (value, config) => { timings.push({ ...config, toValue: value }); return value; },
            Easing: { quad: t => t ** 2, inOut: fn => fn },
        }
        : request.includes('TabBarVisibilityContext') ? { useTabBarScroll: () => { let previous = 0; return { onScrollBeginDrag: () => {}, onScroll: event => { scrolls.push(event); const delta = event.nativeEvent.contentOffset.y - previous; previous = event.nativeEvent.contentOffset.y; return delta; } }; } } : require(request);
    loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
    const hook = loaded.exports.useScrollHeader(mode), cleanup = focus();
    return { ...hook, timings, scrolls, focus, cleanup, stops: () => stops };
}
const event = y => ({ nativeEvent: { contentOffset: { y } } });
for (const [mode, range] of [['compact', 64], ['hide', 100]]) {
    test(`${mode} hides at the first downward pixel and restores at the first upward pixel`, () => {
        const s = setup(mode); s.onScroll(event(1)); assert.equal(s.timings.at(-1).toValue, 1);
        s.onScroll(event(2)); assert.equal(s.timings.at(-1).toValue, 1);
        s.onScroll(event(1)); assert.equal(s.timings.at(-1).toValue, 0);
        assert.equal(s.scrolls.length, 3); assert.ok(s.timings.every(t => t.duration === 240));
        s.cleanup();
    });
    test(`${mode} does not restart animation in the same direction and cancels on blur`, () => {
        const s = setup(mode); s.onScroll(event(range)); s.onScroll(event(range + 20));
        assert.equal(s.timings.length, 1); assert.equal(s.scrolls.length, 2);
        s.cleanup(); const count = s.timings.length; s.onScroll(event(1)); assert.equal(s.timings.length, count);
        const cleanup = s.focus(); assert.equal(s.progress.value, 0); s.onScroll(event(range + 30)); assert.equal(s.timings.at(-1).toValue, 1);
        cleanup();
    });
}
