// Legacy entry point: verify translations without copying English into other languages.
const { audit } = require('./scripts/audit-i18n.cjs');
const result = audit();
if (result.errors.length) {
    console.error(result.errors.join('\n'));
    process.exitCode = 1;
} else {
    console.log(`${result.languages.length} languages verified; no files changed.`);
}
