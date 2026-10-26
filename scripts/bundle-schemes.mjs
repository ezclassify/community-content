#!/usr/bin/env node
/**
 * Compile the scheme folder to the dist SCHEME_DIR that ships in the npm
 * package.
 *
 * Public equivalent of `ezclassify bundle scheme-folder --out dist/schemes`.
 * Each definition becomes one wire-format JSON file, and the published contexts
 * become an index:
 *
 *   dist/schemes/<id>@<version>.json         { scheme: {...} }
 *   dist/schemes/<id>@<version>.guide.json   { guide: {...} }
 *   dist/schemes/<id>@<version>.access.json  { access: {...} }
 *   dist/schemes/contexts.json               { contexts: [...] } incl. latest aliases
 *
 * Every document is validated against its published JSON Schema first, so a
 * malformed scheme cannot reach dist.
 *
 * One deliberate difference from the CLI's `bundle` verb: the CLI reorders each
 * document's keys into the engine's canonical reading order before writing.
 * That reordering lives in the engine and is not public, so this script emits
 * the authored document as-is. JSON object key order carries no meaning to any
 * consumer, and both forms parse to the same value; what ships is the same
 * document either way.
 * @module
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
    FOLDER,
    REPO_ROOT,
    highestVersion,
    readDefinitions,
    readManifest,
    validateDefinitionFile,
} from './lib/scheme-folder.mjs';

const outDir = path.join(REPO_ROOT, 'dist', 'schemes');

const manifest = readManifest(FOLDER);
const definitions = readDefinitions(FOLDER);

// Validate everything before writing anything. A half-written dist is worse
// than no dist: the next command reads it and believes it.
const errors = [];
for (const [kind, defs] of Object.entries(definitions)) {
    for (const def of defs) {
        const result = validateDefinitionFile(def.file, kind);
        for (const error of result.errors) {
            errors.push(
                `${path.relative(REPO_ROOT, def.file)}: ${error.path || '/'}: ${error.message}`,
            );
        }
    }
}
if (errors.length > 0) {
    console.error('[bundle-schemes] refusing to build an invalid folder:');
    for (const error of errors) console.error(`  ${error}`);
    process.exit(1);
}

/** JSON exactly as the dist contract states it: 2-space indent, trailing newline. */
const toJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

/** Filename suffix per kind; schemes carry none. */
const SUFFIX = { scheme: '', guide: '.guide', access: '.access' };

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const written = [];

for (const kind of ['scheme', 'guide', 'access']) {
    for (const def of definitions[kind]) {
        const name = `${def.id}@${def.version}${SUFFIX[kind]}.json`;
        fs.writeFileSync(path.join(outDir, name), toJson(def.document), 'utf-8');
        written.push(name);
    }
}

/**
 * Build one context index entry. Refs stay concrete: a `latest` alias exists at
 * the context level only, never on the components a context resolved to.
 *
 * @param {Record<string, unknown>} doc A parsed context document.
 * @returns {Record<string, unknown>} The index entry.
 */
function contextEntry(doc) {
    const ref = (value) => {
        if (value && typeof value === 'object') return value;
        const [id, version] = String(value).split('@');
        return { id, version };
    };
    const entry = { id: doc.id, version: doc.version, scheme: ref(doc.scheme) };
    if (Array.isArray(doc.layers) && doc.layers.length > 0) {
        entry.scheme.layers = doc.layers.map(ref);
    }
    if (doc.description) entry.description = doc.description;
    if (Array.isArray(doc.guides) && doc.guides.length > 0) {
        entry.guides = doc.guides.map(ref);
    }
    if (doc.access) entry.access = ref(doc.access);
    return entry;
}

// A context the manifest marks `publish: false` is a building block, not a
// resolvable context, and stays out of the index.
const unpublished = new Set(
    (manifest.contexts ?? [])
        .filter((entry) => entry.publish === false)
        .flatMap((entry) => (entry.versions ?? []).map((v) => `${entry.id}@${v}`)),
);

const contexts = definitions.context
    .filter((def) => !unpublished.has(`${def.id}@${def.version}`))
    .map((def) => contextEntry(def.doc))
    .sort((a, b) => (`${a.id}@${a.version}` < `${b.id}@${b.version}` ? -1 : 1));

// One `latest` alias per context id: a full duplicate of the winning entry with
// its version overwritten, so a consumer can resolve `latest` without knowing
// the version inventory.
const aliases = [];
for (const id of [...new Set(contexts.map((c) => c.id))]) {
    const versions = contexts.filter((c) => c.id === id).map((c) => c.version);
    const declared = (manifest.contexts ?? []).find((e) => e.id === id)?.latest;
    const latest = declared && versions.includes(declared) ? declared : highestVersion(versions);
    const source = contexts.find((c) => c.id === id && c.version === latest);
    if (source) aliases.push({ ...source, version: 'latest' });
}

fs.writeFileSync(
    path.join(outDir, 'contexts.json'),
    toJson({ contexts: [...contexts, ...aliases] }),
    'utf-8',
);
written.push('contexts.json');

console.log(
    `[bundle-schemes] wrote ${written.length} files to ${path.relative(REPO_ROOT, outDir)}/`,
);
