const { test } = require('node:test'),
    assert = require('node:assert/strict'),
    fs = require('node:fs'),
    ts = require('typescript');
function load(file) {
    const m = { exports: {} };
    new Function(
        'module',
        'exports',
        ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2022,
            },
        }).outputText,
    )(m, m.exports);
    return m.exports;
}
const { parseMixSource, mixEmbedUrl } = load('../src/utils/profileMixes.ts');
const { isDJProfileComplete, canUseDJProfile } = load(
    '../src/utils/communityProfile.ts',
);
test('individual recordings canonicalize tracking links and build official embeds', () => {
    const mc = parseMixSource(
        ' https://mixcloud.com/DjOne/my-mix/?utm_source=share#play ',
    );
    assert.deepEqual(mc, {
        platform: 'mixcloud',
        source_url: 'https://www.mixcloud.com/DjOne/my-mix/',
    });
    assert.equal(
        new URL(mixEmbedUrl(mc)).searchParams.get('feed'),
        '/DjOne/my-mix/',
    );
    const sc = parseMixSource('https://www.soundcloud.com/dj/my-mix/?si=123');
    assert.equal(sc.source_url, 'https://soundcloud.com/dj/my-mix');
    assert.equal(
        new URL(mixEmbedUrl(sc)).searchParams.get('auto_play'),
        'false',
    );
});
test('profile links, arbitrary HTML, unsafe hosts and collection links cannot become players', () => {
    for (const value of [
        'https://mixcloud.com/dj/',
        'https://soundcloud.com/dj',
        'javascript:alert(1)',
        'http://mixcloud.com/a/b',
        'https://mixcloud.com.evil.test/a/b',
        'https://mixcloud.com@evil.test/a/b',
        'https://x:pass@mixcloud.com/a/b',
        'https://mixcloud.com:444/a/b',
        'https://mixcloud.com/genres/house/',
        'https://soundcloud.com/dj/sets/my-playlist',
        'https://soundcloud.com/dj/likes',
        'https://mixcloud.com/a/%22bad/',
        '<iframe src="https://mixcloud.com/a/b"></iframe>',
    ])
        assert.throws(() => parseMixSource(value), value);
    assert.throws(() =>
        mixEmbedUrl({
            platform: 'soundcloud',
            source_url: 'https://mixcloud.com/a/b/',
        }),
    );
});
test('social use requires photo, city and at least one genre, with opt-in public visibility', () => {
    const complete = {
        avatar_url: 'https://example.com/a.jpg',
        city: 'Madrid',
        genres: 'Jazz · House',
        is_visible: true,
    };
    assert.equal(canUseDJProfile(complete), true);
    for (const partial of [
        null,
        { ...complete, avatar_url: null },
        { ...complete, city: ' \t ' },
        { ...complete, genres: ' · , ; | ' },
    ])
        assert.equal(isDJProfileComplete(partial), false);
    assert.equal(canUseDJProfile({ ...complete, is_visible: false }), false);
    assert.equal(isDJProfileComplete({ ...complete, is_visible: false }), true);
});
test('expanded genre catalogue includes Jazz and preserves multi-selection', () => {
    const { parseMusicGenres, suggestMusicGenres } = load(
        '../src/utils/musicGenres.ts',
    );
    assert.deepEqual(parseMusicGenres('jazz · JAZZ · acid jazz · house'), [
        'Jazz',
        'Acid Jazz',
        'House',
    ]);
    assert.ok(suggestMusicGenres('jazz').includes('Jazz'));
});

test('official player redirects stay embedded and external navigation does not', () => {
    const { isMixPlayerNavigation } = load('../src/utils/profileMixes.ts');
    const source = parseMixSource(
        'https://www.mixcloud.com/spartacus/party-time/',
    );
    assert.equal(
        isMixPlayerNavigation(
            'https://player-widget.mixcloud.com?feed=%2Fspartacus%2Fparty-time%2F&light=1',
            source,
        ),
        true,
    );
    assert.equal(isMixPlayerNavigation(mixEmbedUrl(source), source), true);
    assert.equal(
        isMixPlayerNavigation(
            'https://player-widget.mixcloud.com.evil.test?feed=%2Fspartacus%2Fparty-time%2F',
            source,
        ),
        false,
    );
    assert.equal(isMixPlayerNavigation(source.source_url, source), false);
    const sc = parseMixSource('https://soundcloud.com/dj/my-mix');
    assert.equal(isMixPlayerNavigation(mixEmbedUrl(sc), sc), true);
});
