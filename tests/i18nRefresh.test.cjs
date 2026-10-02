const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const i18next = require('i18next');
const { initReactI18next } = require('react-i18next');

function evaluateTranslations(engine, deviceLanguage = 'es') {
    const filename = path.resolve(__dirname, '../src/i18n/index.ts');
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const module = { exports: {} };
    const localRequire = name => {
        if (name === 'expo-localization') return { getLocales: () => [{ languageCode: deviceLanguage }] };
        if (name === 'i18next') return engine;
        if (name === 'react-i18next') return { initReactI18next };
        return require(path.resolve(path.dirname(filename), name));
    };
    new Function('require', 'module', 'exports', source)(localRequire, module, module.exports);
    return module.exports;
}

test('first launch has community labels immediately, without an async initialization gap', () => {
    const engine = i18next.createInstance();
    evaluateTranslations(engine);
    assert.equal(engine.isInitialized, true);
    assert.equal(engine.t('community.title'), 'Comunidad');
    assert.equal(engine.t('community.myProfile'), 'Mi perfil');
});

test('Fast Refresh replaces a retained old resource bundle and preserves selected language', async () => {
    const engine = i18next.createInstance();
    await engine.init({ lng: 'es', fallbackLng: 'en', resources: { es: { translation: { home: 'Inicio' } } } });
    assert.equal(engine.t('community.myProfile'), 'community.myProfile');
    let notifications = 0;
    engine.on('languageChanged', () => notifications++);
    evaluateTranslations(engine, 'en');
    assert.equal(engine.language, 'es');
    assert.equal(engine.t('community.myProfile'), 'Mi perfil');
    assert.equal(engine.t('community.editProfile'), 'Editar perfil');
    assert(notifications > 0, 'mounted screens must receive a translation refresh event');
    assert.equal(engine.t('home'), 'Inicio');
});
