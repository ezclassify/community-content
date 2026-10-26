#!/usr/bin/env node
/**
 * Repo-local clean for community-content. Removes build outputs and tooling caches.
 *
 * Flags:
 *   --cache-only    Caches only (vite, tsc incremental, tmp).
 *   --deep          Also remove node_modules.
 * @module
 */
import { rmSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The script's own location, not the current working directory: `npm run
// clean` from a subdirectory must still clean this repository rather than
// recursively deleting `dist` and `node_modules` under wherever the shell
// happened to be.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const CACHE_ONLY = args.has('--cache-only');
const DEEP = args.has('--deep');

const CACHE_DIRS = ['node_modules/.cache', 'node_modules/.vite', 'tmp'];
const BUILD_DIRS = ['dist', 'build', 'coverage', 'test-results', '.rollup.cache'];
const CACHE_FILE_PATTERNS = [/\.tsbuildinfo$/];

function removeIfExists(path) {
    if (!existsSync(path)) return false;
    try {
        rmSync(path, { recursive: true, force: true });
        return true;
    } catch (err) {
        console.error(`  failed: ${path}: ${err.message}`);
        return false;
    }
}

function walkForFiles(dir, depth = 0) {
    if (depth > 8) return;
    let entries;
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' && !DEEP) continue;
            if (entry.name === '.git') continue;
            walkForFiles(full, depth + 1);
        } else if (entry.isFile()) {
            if (CACHE_FILE_PATTERNS.some((p) => p.test(entry.name))) removeIfExists(full);
        }
    }
}

function findPackageDirs(root) {
    // community-content is a single-package data repo: the root is the only
    // package directory, so there are no monorepo workspace roots to scan.
    return [root];
}

console.log(`Cleaning repo at ${ROOT}`);
console.log(`  mode: ${CACHE_ONLY ? 'cache-only' : DEEP ? 'deep' : 'full'}`);

const dirs = findPackageDirs(ROOT);
let removed = 0;

for (const dir of dirs) {
    for (const name of CACHE_DIRS) {
        if (removeIfExists(join(dir, name))) {
            console.log(`  ✓ ${relative(ROOT, join(dir, name))}`);
            removed++;
        }
    }
    if (!CACHE_ONLY) {
        for (const name of BUILD_DIRS) {
            if (removeIfExists(join(dir, name))) {
                console.log(`  ✓ ${relative(ROOT, join(dir, name))}`);
                removed++;
            }
        }
    }
    if (DEEP) {
        if (removeIfExists(join(dir, 'node_modules'))) {
            console.log(`  ✓ ${relative(ROOT, join(dir, 'node_modules'))}`);
            removed++;
        }
    }
}

for (const dir of dirs) walkForFiles(dir);

console.log(`Done. Removed ${removed} entr${removed === 1 ? 'y' : 'ies'}.`);
