const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const moduleUnderTest = { exports: {} };
const compiled = ts.transpileModule(fs.readFileSync(require.resolve('../src/utils/cities.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
new Function('module', 'exports', compiled)(moduleUnderTest, moduleUnderTest.exports);
const { normalizeCity, cityKey, suggestCities } = moduleUnderTest.exports;
const { parsePhotonCities, mergeCitySuggestions } = moduleUnderTest.exports;

test('external suggestions reject venues, retain geographic identity and merge local cities first', () => {
    const place = (id, country, code) => ({ properties: { osm_type: 'R', osm_id: id, osm_key: 'place', osm_value: 'city', name: 'Córdoba', state: 'Region', country, countrycode: code } });
    const cities = parsePhotonCities({ features: [place(1, 'España', 'ES'), place(2, 'Argentina', 'AR'), place(1, 'España', 'ES'), { properties: { osm_key: 'amenity', osm_value: 'restaurant', name: 'Córdoba' } }, place('invalid', 'Spain', 'ES')] });
    assert.equal(cities.length, 2);
    const local = { ...cities[1], city: 'Córdoba' };
    const merged = mergeCitySuggestions([local], cities);
    assert.deepEqual(merged.map(x => x.city_location.countryCode), ['AR', 'ES']);
    assert.equal(merged[0], local);
    assert.throws(() => parsePhotonCities({ status: 'error' }));
});

test('manual cities have consistent casing and whitespace, preserving accents and worldwide scripts', () => {
    for (const variant of ['Sevilla', 'sevilla', 'SEvilla', 'sEvilla', '  SEVILLA '])
        assert.equal(normalizeCity(variant), 'Sevilla');
    assert.equal(normalizeCity('  SÃO   PAULO  '), 'São Paulo');
    assert.equal(normalizeCity('東京'), '東京');
    assert.equal(normalizeCity('القاهرة'), 'القاهرة');
    assert.equal(normalizeCity('saint-étienne'), 'Saint-Étienne');
    assert.equal(cityKey('Málaga'), cityKey(' MALAGA '));
    assert.equal(cityKey('Sevilla'), cityKey('SEvilla'));
});

test('suggestions deduplicate variants and prefer exact and prefix matches', () => {
    assert.deepEqual(suggestCities('sev', ['SEvilla', 'sevilla', 'Sevilla', 'San Sebastián', 'Severín']), ['Severín', 'Sevilla']);
    assert.deepEqual(suggestCities('malaga', ['Málaga', 'Malaga', 'Nueva Málaga']), ['Málaga', 'Nueva Málaga']);
    assert.deepEqual(suggestCities('zzzzz', ['Madrid']), []);
    assert.deepEqual(suggestCities('m', ['Madrid']), []);
    assert.equal(suggestCities('city', Array.from({length: 10}, (_, i) => `City ${i}`)).length, 6);
    // Typing an unknown place is allowed; no unverified spelling correction or translation.
    assert.notEqual(cityKey('Seville'), cityKey('Sevilla'));
});
