#!/usr/bin/env node
/**
 * Run the README's examples and assert what the README claims.
 *
 * CI runs this after `npm run build`, so the quickstart can never drift from
 * what the built package actually contains. The package self-reference
 * (`@ezclassify/schemes/...`) resolves through the `exports` map to `dist/`,
 * exactly as it does for a consumer installing from npm.
 *
 * Every assertion here is about this package's own artifacts. Loading a scheme
 * into a running engine is not something a public content repository can
 * demonstrate.
 * @module
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// README: the compiled wire-format JSON, one file per scheme.
import tlp from '@ezclassify/schemes/tlp@2.0.0.json' with { type: 'json' };

assert.equal(
    typeof tlp.scheme,
    'object',
    'the compiled artifact wraps the document in a `scheme` envelope',
);
assert.equal(tlp.scheme.id, 'tlp', `scheme id: expected tlp, got ${tlp.scheme.id}`);
assert.equal(
    tlp.scheme.version,
    '2.0.0',
    `scheme version: expected 2.0.0, got ${tlp.scheme.version}`,
);
console.log('compiled:', tlp.scheme.id, tlp.scheme.version);

// README: the context index ships alongside the schemes.
const { default: contexts } = await import('@ezclassify/schemes/contexts.json', {
    with: { type: 'json' },
});
assert.ok(Array.isArray(contexts.contexts), 'contexts.json holds a `contexts` array');
console.log('contexts:', contexts.contexts.length, 'published');

// README: each scheme's authored YAML is exported as a string, byte-identical
// to the source. The README sells these as the authored document itself, so
// assert the whole bytes rather than an opening token. This runs against the
// built dist through the self-reference, so it gates the published string.
const yamlExports = [
    ['@ezclassify/schemes/tlp', 'tlpSchemeYaml', 'tlp@2.0.0.yaml'],
    ['@ezclassify/schemes/cvss', 'cvssSchemeYaml', 'cvss@3.1.0.yaml'],
    ['@ezclassify/schemes/cvss-v4', 'cvssV4SchemeYaml', 'cvss-v4@4.0.0.yaml'],
];
for (const [specifier, exportName, sourceFile] of yamlExports) {
    const mod = await import(specifier);
    const onDisk = readFileSync(`scheme-folder/schemes/${sourceFile}`, 'utf-8');
    assert.equal(
        mod[exportName],
        onDisk,
        `${exportName} must be byte-identical to scheme-folder/schemes/${sourceFile}`,
    );
}
console.log('exports:', yamlExports.length, 'YAML string exports byte-identical to source');

// The package ships data. A runtime dependency would make it something else.
const manifest = JSON.parse(readFileSync('package.json', 'utf-8'));
assert.deepEqual(
    manifest.dependencies ?? {},
    {},
    'this package must ship with no runtime dependencies',
);
console.log('deps    : none, as documented');

console.log('[readme-quickstart] every README example ran and matched its documented output.');
