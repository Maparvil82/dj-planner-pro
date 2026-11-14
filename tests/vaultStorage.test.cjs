const test = require('node:test'),
    assert = require('node:assert/strict'),
    fs = require('node:fs'),
    ts = require('typescript'),
    vm = require('node:vm');
function load(file, requireFixture) {
    const mod = { exports: {} };
    vm.runInNewContext(
        ts.transpileModule(fs.readFileSync(file, 'utf8'), {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2022,
            },
        }).outputText,
        { exports: mod.exports, module: mod, require: requireFixture, console },
    );
    return mod.exports;
}
const limits = load('src/utils/storageLimits.ts', () => {
    throw new Error('unexpected import');
});
function fixture() {
    let dbDeletes = 0,
        failStorage = false,
        failInsert = false;
    const removes = [];
    const files = [
        { path: 'u/f/new', url: '' },
        {
            path: null,
            url: 'https://example.invalid/storage/v1/object/public/vault/u/f/old%20file.pdf',
        },
    ];
    const client = {
        storage: {
            from: () => ({
                remove: async (paths) => {
                    removes.push(paths);
                    return {
                        error: failStorage
                            ? { message: 'storage failed' }
                            : null,
                    };
                },
                upload: async () => ({ error: null }),
                getPublicUrl: (path) => ({
                    data: {
                        publicUrl:
                            'https://example.invalid/storage/v1/object/public/vault/' +
                            path,
                    },
                }),
            }),
        },
        from: () => ({
            select: () => ({
                eq: () => ({
                    order: async () => ({ data: files, error: null }),
                }),
            }),
            delete: () => ({
                eq: async () => {
                    dbDeletes++;
                    return { error: null };
                },
            }),
            insert: () => ({
                select: () => ({
                    single: async () => ({
                        data: { id: 'f' },
                        error: failInsert ? { message: 'insert failed' } : null,
                    }),
                }),
            }),
        }),
    };
    const { vaultService } = load('src/services/vault.ts', (request) =>
        request === 'expo-crypto'
            ? { randomUUID: () => 'random' }
            : request.includes('storageLimits')
              ? limits
              : { supabase: client },
    );
    return {
        vaultService,
        removes,
        deletes: () => dbDeletes,
        fail: () => {
            failStorage = true;
        },
        insertFail: () => {
            failInsert = true;
        },
    };
}
test('folder removal uses stored paths and legacy URLs, and preserves metadata when Storage fails', async () => {
    const f = fixture();
    f.fail();
    await assert.rejects(
        f.vaultService.deleteFolder('folder'),
        (e) => e.message === 'storage failed',
    );
    assert.equal(f.deletes(), 0);
    assert.deepEqual(Array.from(f.removes[0]), ['u/f/new', 'u/f/old file.pdf']);
});
test('single-file removal does not report success or delete metadata on Storage failure', async () => {
    const f = fixture();
    f.fail();
    await assert.rejects(
        f.vaultService.deleteFile('f', 'u/f/file'),
        (e) => e.message === 'storage failed',
    );
    assert.equal(f.deletes(), 0);
});
test('failed document metadata insertion removes the newly uploaded object', async () => {
    const f = fixture();
    f.insertFail();
    await assert.rejects(
        f.vaultService.uploadFile(
            'u',
            'folder',
            'invoice.pdf',
            new Uint8Array(10),
            'application/pdf',
            10,
        ),
        (e) => e.message === 'insert failed',
    );
    assert.equal(f.removes[0][0], 'u/folder/random');
});
test('document size is measured from actual payload, rejecting oversized or executable files before upload', async () => {
    const f = fixture();
    await assert.rejects(
        f.vaultService.uploadFile(
            'u',
            'folder',
            'invoice.pdf',
            { byteLength: 11 * 1024 * 1024 },
            'application/pdf',
            1,
        ),
        /documentTooLarge/,
    );
    await assert.rejects(
        f.vaultService.uploadFile(
            'u',
            'folder',
            'script.html',
            new Uint8Array(10),
            'text/html',
            10,
        ),
        /unsupported/,
    );
    assert.equal(f.deletes(), 0);
});
