#!/usr/bin/env node
/**
 * Generate a CycloneDX SBOM for this repository's build from its lockfile.
 *
 * The published package has no production dependencies: what ships is compiled
 * scheme data plus the small library that exposes it. So the interesting
 * inventory is the authoring and build toolchain, and the document says so
 * rather than implying a runtime closure it does not have.
 *
 * Components come from `package-lock.json`, not from the manifest ranges. The
 * lockfile names the exact versions an install resolves, including transitive
 * ones, and carries the `resolved` URL and `integrity` hash a scanner needs.
 * A manifest range such as `^9.39.4` is not a version and must never be
 * reported as one.
 *
 * The serial number is derived from the lockfile bytes, so the same dependency
 * tree always produces the same document identity. The timestamp is the build
 * time, which is what it is meant to record.
 *
 * Usage:
 *
 *     node scripts/generate-sbom.mjs [--lockfile=PATH] [--out=PATH]
 *
 * `--lockfile` and `--out` are what the tests use to run the real generator
 * over a throwaway tree, and to read this repository's own lockfile without
 * rewriting the published `dist/sbom.json`.
 * @module
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { nameFromLockfilePath } from './lib/lockfile.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf-8'));

/**
 * Read the optional path overrides off the command line.
 *
 * @param {string[]} argv - Arguments after the script name.
 * @returns {{ lockfile?: string, out?: string }} Overrides, if given.
 */
function parseArguments(argv) {
    const options = {};
    for (const argument of argv) {
        const match = /^--(lockfile|out)=(.+)$/.exec(argument);
        if (!match) {
            throw new Error(
                `Unrecognized argument "${argument}". Usage: generate-sbom.mjs [--lockfile=PATH] [--out=PATH]`,
            );
        }
        options[match[1]] = match[2];
    }
    return options;
}

const options = parseArguments(process.argv.slice(2));

const lockfilePath = path.resolve(options.lockfile ?? path.join(repoRoot, 'package-lock.json'));
let lockfileText;
try {
    lockfileText = fs.readFileSync(lockfilePath, 'utf-8');
} catch (error) {
    console.error(
        `Cannot build an SBOM without ${path.relative(repoRoot, lockfilePath)}: ${error.message}\n` +
            'Run `npm run deps:relock` first; the manifest ranges are not an inventory.',
    );
    process.exit(1);
}
const lockfile = JSON.parse(lockfileText);

/**
 * Build the CycloneDX purl for a package. The leading `@` of a scoped name is
 * percent-encoded, as the purl specification requires.
 *
 * @param {string} name - Package name.
 * @param {string} version - Exact resolved version.
 * @returns {string} A `pkg:npm/...` purl.
 */
function purlFor(name, version) {
    return `pkg:npm/${name.replace(/^@/, '%40')}@${version}`;
}

/**
 * Render a lockfile `license` value as a CycloneDX `licenses` array.
 *
 * CycloneDX allows either a single SPDX identifier under `license.id` or a
 * whole SPDX expression under `expression`, and a consumer validating the
 * document against the schema rejects an expression parked in `id`. npm
 * lockfiles carry both forms, so pick by shape: anything with whitespace,
 * parentheses, or an SPDX operator is an expression.
 *
 * @param {string} value - The lockfile entry's `license` value.
 * @returns {object[]} A CycloneDX `licenses` array.
 */
function licensesFor(value) {
    const declared = value.trim();
    if (/[\s()]|\bOR\b|\bAND\b|\bWITH\b/.test(declared)) return [{ expression: declared }];
    return [{ license: { id: declared } }];
}

const seen = new Map();
for (const [lockPath, entry] of Object.entries(lockfile.packages ?? {})) {
    if (lockPath === '') continue;
    if (entry.link) continue;
    const name = entry.name ?? nameFromLockfilePath(lockPath);
    if (!name || typeof entry.version !== 'string') continue;
    const key = `${name}@${entry.version}`;
    if (seen.has(key)) continue;

    const component = {
        type: 'library',
        name,
        version: entry.version,
        purl: purlFor(name, entry.version),
        scope: entry.dev ? 'excluded' : 'required',
    };
    if (typeof entry.license === 'string') component.licenses = licensesFor(entry.license);
    if (typeof entry.resolved === 'string') {
        component.externalReferences = [{ type: 'distribution', url: entry.resolved }];
    }
    if (typeof entry.integrity === 'string') {
        const [algorithm, value] = entry.integrity.split('-');
        const alg = { sha512: 'SHA-512', sha256: 'SHA-256', sha1: 'SHA-1' }[algorithm];
        if (alg && value) {
            component.hashes = [{ alg, content: Buffer.from(value, 'base64').toString('hex') }];
        }
    }
    seen.set(key, component);
}

const components = [...seen.values()].sort((a, b) =>
    a.purl < b.purl ? -1 : a.purl > b.purl ? 1 : 0,
);

// A UUID whose bytes come from the lockfile digest, so a document identity is
// a function of the tree it describes rather than of the moment it was built.
const digest = crypto.createHash('sha256').update(lockfileText).digest();
const uuidBytes = Buffer.from(digest.subarray(0, 16));
uuidBytes[6] = (uuidBytes[6] & 0x0f) | 0x40;
uuidBytes[8] = (uuidBytes[8] & 0x3f) | 0x80;
const hex = uuidBytes.toString('hex');
const serialNumber = `urn:uuid:${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;

const sbom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber,
    version: 1,
    metadata: {
        timestamp: new Date().toISOString(),
        component: {
            type: 'library',
            name: pkg.name,
            version: pkg.version,
            description: pkg.description,
        },
        tools: [{ name: 'ezclassify-sbom-generator', version: '2.0.0' }],
        properties: [
            {
                name: 'ezclassify:inventory',
                value: 'build-and-authoring toolchain; the published package has no production dependencies',
            },
        ],
    },
    components,
};

const outPath = path.resolve(options.out ?? path.join(repoRoot, 'dist', 'sbom.json'));
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(sbom, null, 2));
console.log(`SBOM generated: ${outPath} (${components.length} components)`);
