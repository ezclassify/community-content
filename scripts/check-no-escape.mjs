#!/usr/bin/env node
/**
 * Static independence and architecture-ownership gate. Five assertions:
 *
 *   1. No dependency field in a publishable package.json uses a path-based
 *      protocol (file:, link:, workspace:, portal:). Those resolve against
 *      the local checkout and cannot ship; a published artifact carrying one
 *      is broken for every consumer.
 *   2. No source file in a publishable workspace has a relative import that
 *      resolves above the REPO root. Cross-workspace relative imports inside
 *      the repo are the repo's own business; only escapes into non-repo
 *      territory are flagged (they only work in a specific multi-repo
 *      checkout layout, and a clean clone of this repository has none).
 *   3. Public EzClassify dependencies are consumed through package entrypoints,
 *      never through another repository's src/ or internal/ implementation.
 *   4. schemes/ remains documentation plus consumer tests; executable helpers
 *      and validators stay shared at the repository root.
 *   5. This public repository does not acquire explicitly private, enterprise,
 *      or customer-specific paths or runtime engine implementations.
 *
 * Usage: node scripts/check-no-escape.mjs [--verbose]
 *
 * @module
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const verbose = process.argv.includes('--verbose');

const DEP_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
const BANNED_PROTOCOL = /^(file|link|workspace|portal):/;
const SOURCE_EXTENSIONS = new Set([
    '.js',
    '.mjs',
    '.cjs',
    '.jsx',
    '.ts',
    '.mts',
    '.cts',
    '.tsx',
    '.vue',
    '.svelte',
]);
const SKIP_DIRS = new Set([
    '.git',
    'node_modules',
    'dist',
    'build',
    'coverage',
    'target',
    'vendor',
    '.cache',
]);

// Specifiers in import/export-from, require(), and dynamic import().
const IMPORT_PATTERNS = [
    /(?:\bimport|\bexport)\s*(?:[\w${},*\s]*?\bfrom\s*)?(['"])([^'"]+)\1/g,
    /\brequire\(\s*(['"])([^'"]+)\1\s*\)/g,
    /\bimport\(\s*(['"])([^'"]+)\1\s*\)/g,
];
const UPSTREAM_IMPLEMENTATION_IMPORT =
    /^(?:@ezclassify-internal(?:\/|$)|@ezclassify\/(?:enterprise|private)(?:[-/]|$)|@ezclassify\/[^/]+\/(?:[^/]+\/)*(?:src|internal|private|enterprise)(?:\/|$))/;
const RUNTIME_IMPLEMENTATION_DECLARATION =
    /\b(?:class|function)\s+(SchemeEngine|GuideEngine|AccessEngine|Context)\b|\b(?:const|let|var)\s+(SchemeEngine|GuideEngine|AccessEngine|Context)\s*=/g;
const SCHEME_CONSUMER_TEST =
    /^schemes\/[^/]+\/[^/]+\/tests\/[^/]+\.spec\.(?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$/;
const PRIVATE_PATH_SEGMENTS = new Set([
    'enterprise',
    'private',
    'proprietary',
    'customer-private',
    'customer-specific',
]);

function readJson(filePath) {
    return JSON.parse(readFileSync(filePath, 'utf8'));
}

function listPublishable() {
    const rootManifest = readJson(path.join(REPO_ROOT, 'package.json'));
    const patterns = rootManifest.workspaces;
    if (!patterns) return [{ dir: REPO_ROOT, manifest: rootManifest }];
    const found = [];
    for (const pattern of patterns) {
        const dirs = pattern.endsWith('/*')
            ? readdirSync(path.join(REPO_ROOT, pattern.slice(0, -2)), {
                  withFileTypes: true,
              })
                  .filter((e) => e.isDirectory())
                  .map((e) => path.join(pattern.slice(0, -2), e.name))
            : [pattern];
        for (const dir of dirs) {
            const manifestPath = path.join(REPO_ROOT, dir, 'package.json');
            if (!existsSync(manifestPath)) continue;
            const manifest = readJson(manifestPath);
            if (manifest.private === true) continue;
            found.push({ dir: path.join(REPO_ROOT, dir), manifest });
        }
    }
    return found;
}

const violations = [];

function walkSources(dir, out = []) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) {
                walkSources(path.join(dir, entry.name), out);
            }
        } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
            out.push(path.join(dir, entry.name));
        }
    }
    return out;
}

function walkFiles(dir, out = []) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) {
                walkFiles(path.join(dir, entry.name), out);
            }
        } else {
            out.push(path.join(dir, entry.name));
        }
    }
    return out;
}

function escapesRepo(fromDir, specifier) {
    // Strip any query/hash a specifier may carry before resolving.
    const clean = specifier.split(/[?#]/)[0];
    const resolved = path.resolve(fromDir, clean);
    return resolved !== REPO_ROOT && !resolved.startsWith(REPO_ROOT + path.sep);
}

const packages = listPublishable();
console.log(
    `[no-escape] checking ${packages.length} publishable package(s) under ${path.basename(REPO_ROOT)}`,
);

for (const pkg of packages) {
    const { name } = pkg.manifest;

    // 1. dependency protocols
    for (const field of DEP_FIELDS) {
        for (const [dep, spec] of Object.entries(pkg.manifest[field] ?? {})) {
            if (BANNED_PROTOCOL.test(spec)) {
                violations.push(`${name} ${field}.${dep} uses a path-based protocol: "${spec}"`);
            }
        }
    }

    // 2-5. import independence and public-repository architecture ownership
    for (const file of walkSources(pkg.dir)) {
        const text = readFileSync(file, 'utf8');
        const fromDir = path.dirname(file);
        const relativeFile = path.relative(REPO_ROOT, file).split(path.sep).join('/');

        if (relativeFile.startsWith('schemes/') && !SCHEME_CONSUMER_TEST.test(relativeFile)) {
            violations.push(
                `${relativeFile} is executable code under schemes/; keep scheme implementations data-only and place shared code at the repository root`,
            );
        }

        RUNTIME_IMPLEMENTATION_DECLARATION.lastIndex = 0;
        for (const match of text.matchAll(RUNTIME_IMPLEMENTATION_DECLARATION)) {
            const line = text.slice(0, match.index).split('\n').length;
            violations.push(
                `${relativeFile}:${line} declares runtime engine implementation "${match[1] ?? match[2]}"; this repository describes policy as data and implements no engine`,
            );
        }

        for (const pattern of IMPORT_PATTERNS) {
            pattern.lastIndex = 0;
            for (const match of text.matchAll(pattern)) {
                const specifier = match[2];
                if (UPSTREAM_IMPLEMENTATION_IMPORT.test(specifier)) {
                    const line = text.slice(0, match.index).split('\n').length;
                    violations.push(
                        `${relativeFile}:${line} imports upstream implementation path "${specifier}"; use a public package entrypoint`,
                    );
                } else if (path.isAbsolute(specifier)) {
                    const line = text.slice(0, match.index).split('\n').length;
                    violations.push(
                        `${relativeFile}:${line} imports absolute path "${specifier}"; use a package entrypoint`,
                    );
                } else if (/^\.\.?\//.test(specifier) && escapesRepo(fromDir, specifier)) {
                    const line = text.slice(0, match.index).split('\n').length;
                    violations.push(
                        `${relativeFile}:${line} imports "${specifier}", which resolves outside the repo`,
                    );
                } else if (verbose && /^\.\.?\//.test(specifier)) {
                    console.log(`  ok  ${relativeFile} -> ${specifier}`);
                }
            }
        }
    }
}

for (const file of walkFiles(REPO_ROOT)) {
    const relativeFile = path.relative(REPO_ROOT, file).split(path.sep).join('/');
    if (!relativeFile.startsWith('schemes/') && !relativeFile.startsWith('scheme-folder/')) {
        continue;
    }
    const privateSegment = relativeFile
        .split('/')
        .find((segment) => PRIVATE_PATH_SEGMENTS.has(segment.toLowerCase()));
    if (privateSegment) {
        violations.push(
            `${relativeFile} uses reserved private-material path segment "${privateSegment}"`,
        );
    }
}

if (violations.length > 0) {
    console.error(`[no-escape] ${violations.length} violation(s):`);
    for (const v of violations) console.error(`  ${v}`);
    process.exit(1);
}
console.log(
    '[no-escape] dependency independence and public data-only architecture boundaries hold.',
);
