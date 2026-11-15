const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const previous = require.extensions['.ts'];
require.extensions['.ts'] = (m, filename) => m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { recoveryCredentials } = require('../src/utils/recoveryLink.ts');
if (previous) require.extensions['.ts'] = previous; else delete require.extensions['.ts'];
test('recovery tokens work for browser, standalone app and Expo Go links', () => {
    for (const base of ['http://localhost:8081/reset-password', 'djplannerpro://reset-password', 'exp://192.168.1.106:8081/--/reset-password']) {
        for (const separator of ['#', '?']) assert.deepEqual(recoveryCredentials(`${base}${separator}type=recovery&access_token=fixture-access&refresh_token=fixture-refresh`), { access_token: 'fixture-access', refresh_token: 'fixture-refresh' });
    }
});
test('recovery does not accept ordinary login, signup, incomplete or expired links', () => {
    for (const suffix of ['', '#type=signup&access_token=a&refresh_token=b', '#access_token=a&refresh_token=b', '#type=recovery&access_token=a', '#type=recovery&access_token=a&refresh_token=b&error_code=otp_expired', '#error=access_denied&type=recovery']) assert.equal(recoveryCredentials(`djplannerpro://reset-password${suffix}`), null);
});
