#!/usr/bin/env node
/**
 * Fails if the lockfile under test is not environment-agnostic.
 *
 * `package-lock.json` is untracked: CI regenerates it with
 * `npm run deps:relock`, installs from it with `npm ci`, and runs this guard
 * against those bytes.
 *
 * Without this guard, a relock on a machine whose `@ezclassify` scope points
 * at a private registry silently bakes in a `resolved` URL only that one
 * environment can reach. `npm run deps:relock` is the only supported way to
 * regenerate the lockfile.
 *
 * First-party `integrity` is deliberately NOT refused here. It is a content
 * hash, not an origin, so a first-party entry that carries one is not
 * unportable the way a first-party `resolved` URL is. See relock.mjs's
 * `--normalize` doc comment for when it can be kept.
 *
 * Usage:
 *
 *     node scripts/check-lockfile-portable.mjs [--lockfile=PATH]
 *
 * `--lockfile` (or `EZCLASSIFY_LOCKFILE_PORTABLE_LOCKFILE`) is what the tests
 * use to point the guard at a throwaway fixture instead of this repo's own
 * lockfile.
 * @module
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { nameFromLockfilePath } from './lib/lockfile.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const FIRST_PARTY_PREFIX = '@ezclassify/';

/**
 * Registry origins any machine can reach. An allowlist rather than a
 * denylist of loopback hosts and well-known local ports: a private mirror on
 * some other host and port is exactly as unportable as a Verdaccio on
 * localhost, and naming the few origins that are portable is the only rule
 * that catches both.
 */
const PORTABLE_REGISTRY_ORIGINS = new Set([
    'https://registry.npmjs.org',
    'https://npm.pkg.github.com',
]);

/**
 * Is this `resolved` value a tarball URL every machine can fetch?
 *
 * @param {string} resolved - The lockfile entry's `resolved` value.
 * @returns {boolean} True when the URL names an allowlisted registry origin.
 */
function isPortableResolvedUrl(resolved) {
    let url;
    try {
        url = new URL(resolved);
    } catch {
        return false;
    }
    return PORTABLE_REGISTRY_ORIGINS.has(url.origin);
}

function parseArguments(argv) {
    const options = {};
    for (const argument of argv) {
        const match = /^--(lockfile)=(.+)$/.exec(argument);
        if (!match) {
            throw new Error(
                `Unrecognized argument "${argument}". Usage: check-lockfile-portable.mjs [--lockfile=PATH]`,
            );
        }
        options[match[1]] = match[2];
    }
    return options;
}

function resolveLockfilePath(options) {
    const raw =
        options.lockfile ??
        process.env['EZCLASSIFY_LOCKFILE_PORTABLE_LOCKFILE'] ??
        resolve(repositoryRoot, 'package-lock.json');
    return resolve(raw);
}

function main() {
    const options = parseArguments(process.argv.slice(2));
    const lockfilePath = resolveLockfilePath(options);

    const lockfile = JSON.parse(readFileSync(lockfilePath, 'utf8'));
    const packages = lockfile.packages ?? {};
    const problems = [];

    for (const [path, entry] of Object.entries(packages)) {
        if (path === '') continue;
        const name = entry.name ?? nameFromLockfilePath(path) ?? '';
        if (typeof entry.resolved === 'string' && !isPortableResolvedUrl(entry.resolved)) {
            problems.push(`${path} -> ${entry.resolved} (not a portable registry origin)`);
        }
        if (name.startsWith(FIRST_PARTY_PREFIX) && entry.resolved) {
            problems.push(
                `${path} pins a first-party \`resolved\` origin; run \`npm run deps:relock\`.`,
            );
        }
    }

    if (problems.length > 0) {
        console.error('package-lock.json is not portable:');
        for (const problem of problems) console.error(`  ${problem}`);
        process.exitCode = 1;
    } else {
        console.log(
            'package-lock.json is portable: every `resolved` names a public registry, ' +
                'and no first-party entry pins an origin.',
        );
    }
}

main();
