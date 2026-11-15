const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function flatten(value, prefix = '', result = {}) {
    for (const [key, child] of Object.entries(value)) {
        const name = prefix ? `${prefix}.${key}` : key;
        if (child && typeof child === 'object' && !Array.isArray(child)) flatten(child, name, result);
        else result[name] = child;
    }
    return result;
}
function staticKeys(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
    if (ts.isConditionalExpression(node)) return [...staticKeys(node.whenTrue), ...staticKeys(node.whenFalse)];
    return [];
}
function sourceKeys() {
    const keys = new Set();
    function scan(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const file = path.join(dir, entry.name);
            if (entry.isDirectory()) scan(file);
            else if (/\.tsx?$/.test(file)) {
                const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
                function visit(node) {
                    if (ts.isCallExpression(node) && node.arguments[0] &&
                        ((ts.isIdentifier(node.expression) && node.expression.text === 't') ||
                        (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 't'))) {
                        for (const key of staticKeys(node.arguments[0])) keys.add(key);
                    }
                    ts.forEachChild(node, visit);
                }
                visit(source);
            }
        }
    }
    scan(path.join(root, 'app'));
    scan(path.join(root, 'src'));
    return keys;
}
const variables = value => [...value.matchAll(/{{-?\s*([^},\s]+)(?:[^}]*)}}/g)].map(match => match[1]).sort();
function audit() {
    const index = fs.readFileSync(path.join(root, 'src/i18n/index.ts'), 'utf8');
    const languages = [...index.matchAll(/from '\.\/languages\/(.+?)\.json'/g)].map(match => match[1]);
    const resources = Object.fromEntries(languages.map(language => [language, flatten(JSON.parse(fs.readFileSync(path.join(root, `src/i18n/languages/${language}.json`), 'utf8')))]));
    const allKeys = new Set([...Object.values(resources).flatMap(Object.keys), ...sourceKeys()]);
    const errors = [];
    const reference = resources.en;
    for (const [language, strings] of Object.entries(resources)) {
        for (const key of allKeys) {
            if (typeof strings[key] !== 'string' || !strings[key].trim()) errors.push(`${language}: missing or empty ${key}`);
            else if (reference[key] && JSON.stringify(variables(strings[key])) !== JSON.stringify(variables(reference[key]))) errors.push(`${language}: interpolation mismatch ${key}`);
        }
    }
    return { languages, keyCount: allKeys.size, errors };
}
if (require.main === module) {
    const result = audit();
    if (result.errors.length) { console.error(result.errors.join('\n')); process.exitCode = 1; }
    else console.log(`${result.languages.length} languages: ${result.keyCount} keys each, with matching interpolation variables.`);
}
module.exports = { audit, flatten };
