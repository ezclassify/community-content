#!/usr/bin/env node
/**
 * Two-step, date-bounded relock.
 *
 * `npm install` resolves the whole dependency tree in one pass, and npm's
 * `min-release-age` / `--before` bound is tree-wide with no supported way to
 * exempt a scope. Bounding a single install therefore also bounds our own
 * `@ezclassify/*` packages, which fails with ETARGET whenever one of them was
 * published inside the window.
 *
 * This script drives the resolve in two passes instead of one, so the date
 * bound only ever touches third-party packages:
 *
 *   1. `--strip`     removes every `@ezclassify/*` dependency from
 *                     package.json and stashes the original.
 *   2. (caller runs `rm -rf node_modules package-lock.json`, then
 *                     `npm install --package-lock-only --before=<cutoff>`)
 *                     this resolves the full third-party tree, bounded.
 *                     Both `node_modules` and `package-lock.json` have to go
 *                     first: npm treats either an installed tree or an
 *                     existing lockfile entry that already satisfies the
 *                     declared range as a settled answer and does not ask the
 *                     registry again, `--before` or not.
 *   3. `--restore`    puts package.json back.
 *   4. (caller runs `npm install --package-lock-only --tag=dev`, unbounded)
 *                     this re-adds the first-party packages. npm is
 *                     lockfile-preferring, so the already-resolved
 *                     third-party versions from step 2 do not move. npm takes
 *                     the version under its default dist-tag whenever that
 *                     version satisfies the range, ahead of the highest one,
 *                     so `--tag=dev` is what makes a `^1.0.0-0` range resolve
 *                     to the newest development build. Every development
 *                     registry tags each build `dev`: the local Verdaccio
 *                     development registry moves `latest` and `dev` together,
 *                     and the GitHub Packages mirror publishes under `dev`
 *                     only. The bounded pass in step 2 keeps npm's default
 *                     tag, so third-party resolution never sees `dev`.
 *   5. `--normalize`  strips `resolved`/`integrity` from the first-party
 *                     lockfile entries so the lockfile carries no
 *                     machine-local registry URL and no integrity hash that
 *                     would break the next install when the same development
 *                     version is republished. `npm ci` re-resolves those
 *                     entries through whichever `@ezclassify:registry` the
 *                     running environment configures.
 *
 *                     The `resolved` strip is permanent. `@ezclassify/*` is
 *                     served by different registries depending on the
 *                     environment, `resolved` is an absolute URL naming
 *                     exactly one of them, and npm offers no per-scope
 *                     rewrite of it, so a lockfile can never carry a
 *                     first-party `resolved` URL that is correct on every
 *                     machine. `integrity` is a content hash, not an origin:
 *                     it can be kept once a version's published bytes never
 *                     change in place and the build that produces them is
 *                     reproducible across the environments that run `npm ci`
 *                     against this lockfile.
 *
 * Orchestrated by `npm run deps:relock`; see package.json.
 * @module
 */
import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = resolve(repositoryRoot, 'package.json');
const backupPath = resolve(repositoryRoot, '.package.json.relock-backup');
const lockfilePath = resolve(repositoryRoot, 'package-lock.json');

const FIRST_PARTY_PREFIX = '@ezclassify/';
const DEPENDENCY_FIELDS = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
];

function readJson(path) {
    return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
    writeFileSync(path, `${JSON.stringify(value, null, 4)}\n`);
}

function strip() {
    if (existsSync(backupPath)) {
        throw new Error(
            `${backupPath} already exists; a previous --strip was never --restore-d. Resolve that first.`,
        );
    }
    const manifest = readJson(manifestPath);
    writeFileSync(backupPath, `${JSON.stringify(manifest, null, 4)}\n`);

    const stripped = { ...manifest };
    for (const field of DEPENDENCY_FIELDS) {
        if (!stripped[field]) continue;
        const kept = {};
        for (const [name, range] of Object.entries(stripped[field])) {
            if (!name.startsWith(FIRST_PARTY_PREFIX)) kept[name] = range;
        }
        stripped[field] = kept;
    }
    writeJson(manifestPath, stripped);
    console.log('relock --strip: first-party dependencies removed from package.json.');
}

function restore() {
    if (!existsSync(backupPath)) {
        throw new Error(`${backupPath} not found; nothing to restore. Run --strip first.`);
    }
    renameSync(backupPath, manifestPath);
    console.log('relock --restore: package.json restored.');
}

function normalize() {
    const lockfile = readJson(lockfilePath);
    const packages = lockfile.packages ?? {};
    let normalized = 0;
    for (const [path, entry] of Object.entries(packages)) {
        if (path === '') continue;
        if (!path.includes('node_modules/')) continue;
        const name =
            entry.name ?? path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
        if (!name.startsWith(FIRST_PARTY_PREFIX)) continue;
        if ('resolved' in entry) {
            delete entry.resolved;
            normalized += 1;
        }
        if ('integrity' in entry) delete entry.integrity;
    }
    writeJson(lockfilePath, lockfile);
    console.log(
        `relock --normalize: ${normalized} first-party lockfile entr${normalized === 1 ? 'y' : 'ies'} de-pinned.`,
    );
}

const mode = process.argv[2];
switch (mode) {
    case '--strip':
        strip();
        break;
    case '--restore':
        restore();
        break;
    case '--normalize':
        normalize();
        break;
    default:
        console.error('Usage: relock.mjs --strip|--restore|--normalize');
        process.exitCode = 1;
}
