const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file) {
    const m = { exports: {} };
    const absolute = path.resolve(__dirname, file);
    const localRequire = (name) =>
        name.startsWith('.')
            ? load(
                  path.relative(
                      __dirname,
                      path.resolve(path.dirname(absolute), name + '.ts'),
                  ),
              )
            : require(name);
    new Function(
        'module',
        'exports',
        'require',
        ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2022,
            },
        }).outputText,
    )(m, m.exports, localRequire);
    return m.exports;
}
const { fetchMixMetadata, mixDuration } = load(
    '../src/services/mixMetadata.ts',
);
const source = {
    platform: 'mixcloud',
    source_url: 'https://www.mixcloud.com/spartacus/party-time/',
};
test('official metadata endpoints, missing data and hostile artwork', async () => {
    const original = global.fetch;
    let calls = 0;
    try {
        global.fetch = async (url) => {
            calls++;
            assert.equal(url, 'https://api.mixcloud.com/spartacus/party-time/');
            return {
                ok: true,
                json: async () => ({
                    key: '/spartacus/party-time/',
                    pictures: {
                        large: 'https://thumbnailer.mixcloud.com/cover.jpg',
                    },
                    user: { name: 'Spartacus' },
                    tags: [{ name: 'Soul' }],
                    audio_length: 3840,
                    play_count: 230,
                }),
            };
        };
        const data = await fetchMixMetadata(source);
        assert.equal(data.duration, 3840);
        assert.equal(data.plays, 230);
        assert.deepEqual(data.genres, ['Soul']);
        assert.equal(
            data.artwork,
            'https://thumbnailer.mixcloud.com/cover.jpg',
        );
        assert.equal(mixDuration(data.duration), '1h 4m');
        await assert.rejects(() =>
            fetchMixMetadata({
                ...source,
                source_url: 'https://evil.test/a/b',
            }),
        );
        assert.equal(calls, 1, 'Invalid links never fetch arbitrary endpoints');
        global.fetch = async () => ({
            ok: true,
            json: async () => ({
                key: '/spartacus/party-time/',
                pictures: {
                    large: 'https://mixcloud.com.evil.test/tracker.png',
                },
                audio_length: -4,
                play_count: '999',
            }),
        });
        assert.deepEqual(await fetchMixMetadata(source), {
            artwork: null,
            author: '',
            genres: [],
            duration: null,
            plays: null,
        });
        global.fetch = async () => ({
            ok: true,
            json: async () => ({ key: '/other/recording/' }),
        });
        await assert.rejects(
            () => fetchMixMetadata(source),
            /INVALID_METADATA/,
        );
        global.fetch = async () => ({ ok: false });
        await assert.rejects(
            () => fetchMixMetadata(source),
            /METADATA_UNAVAILABLE/,
        );
        global.fetch = async (url) => {
            assert.equal(new URL(url).hostname, 'soundcloud.com');
            return {
                ok: true,
                json: async () => ({
                    author_name: 'Artist',
                    thumbnail_url: 'https://i1.sndcdn.com/cover.jpg',
                    html: '<script>never use me</script>',
                }),
            };
        };
        const soundcloud = await fetchMixMetadata({
            platform: 'soundcloud',
            source_url: 'https://soundcloud.com/dj/mix',
        });
        assert.equal(soundcloud.artwork, 'https://i1.sndcdn.com/cover.jpg');
        assert.equal(soundcloud.duration, null);
        assert.ok(!('html' in soundcloud));
    } finally {
        global.fetch = original;
    }
});
