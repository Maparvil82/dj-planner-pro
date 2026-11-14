const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, require, extras = {}) {
 const mod = { exports: {} };
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module: mod, exports: mod.exports, require, URL, Map, Set, Promise, ...extras });
 return mod.exports;
}
function fixture() {
 let listener, now = 0, failure = false, release;
 const calls = [];
 const media = load('src/services/storageMedia.ts', () => ({ supabase: {
  auth: { onAuthStateChange: fn => { listener = fn; } },
  storage: { from: bucket => ({
   createSignedUrls: async paths => { calls.push({ bucket, paths: [...paths] }); if (release) await release; return failure ? { error: Error('offline') } : { data: paths.map(path => ({ path, signedUrl: 'https://signed/' + path })) }; },
   createSignedUrl: async path => { calls.push({ bucket, paths: [path] }); return { data: { signedUrl: 'https://signed/' + path } }; }
  }) }
 } }), { Date: { now: () => now }, process: { env: { EXPO_PUBLIC_SUPABASE_URL: 'https://storage.example' } } });
 listener('SIGNED_IN', { user: { id: 'a' } });
 return { media, calls, setTime: n => now = n, fail: n => failure = n, hold: p => release = p, account: id => listener('SIGNED_IN', id ? { user: { id } } : null) };
}
const uri = path => 'https://storage.example/storage/v1/object/public/avatars/' + path;
test('cards share one batch for avatar and cover; repeated and mounted images reuse it', async () => {
 const f = fixture(); let finish; f.hold(new Promise(r => finish = r));
 const batch = f.media.primeMediaUrls([uri('avatar.jpg'), uri('cover.jpg'), uri('avatar.jpg')]);
 const mounted = f.media.signedMediaUrl(uri('avatar.jpg'));
 assert.equal(f.calls.length, 1); assert.deepEqual(f.calls[0].paths, ['avatar.jpg', 'cover.jpg']);
 finish(); await batch; assert.equal(await mounted, 'https://signed/avatar.jpg');
 assert.equal(f.media.cachedMediaUrl(uri('cover.jpg')), 'https://signed/cover.jpg');
 await f.media.primeMediaUrls([uri('avatar.jpg'), uri('cover.jpg')]); assert.equal(f.calls.length, 1);
 f.setTime(241000); await f.media.primeMediaUrls([uri('avatar.jpg')]); assert.equal(f.calls.length, 2);
 f.account('b'); assert.equal(f.media.cachedMediaUrl(uri('avatar.jpg')), undefined);
});
test('failed batches recover and responses from a previous account do not fill the cache', async () => {
 const f = fixture(); f.fail(true);
 assert.equal((await f.media.primeMediaUrls([uri('a')]))[0].status, 'rejected');
 f.fail(false); await f.media.primeMediaUrls([uri('a')]); assert.equal(f.calls.length, 2);
 let finish; f.hold(new Promise(r => finish = r));
 const pending = f.media.primeMediaUrls([uri('b')]); f.account('b'); finish();
 assert.equal((await pending)[0].status, 'rejected'); assert.equal(f.media.cachedMediaUrl(uri('b')), undefined);
});
test('preload is bounded to first six cards and starts native downloads without blocking', async () => {
 const requested = [], downloads = [];
 const helper = load('src/services/communityImages.ts', name => name === 'react-native' ? { Platform: { OS: 'ios' }, Image: { prefetch: async uri => downloads.push(uri) } } : { primeMediaUrls: async uris => { requested.push(...uris); return uris.map(value => ({ status: 'fulfilled', value })); } });
 helper.prefetchCommunityImages(Array.from({length:20}, (_,i) => ({avatar_url:'avatar'+i,cover_url:'cover'+i})));
 await new Promise(r => setImmediate(r));
 assert.equal(requested.length,12); assert.equal(downloads.length,12); assert.equal(requested.includes('avatar6'),false);
});
