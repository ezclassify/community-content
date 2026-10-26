#!/usr/bin/env node
/**
 * Dependency license gate.
 *
 * Every package in the installed tree must declare a license from the allowed
 * set. Anything else, including a package that declares none at all, fails and
 * is named, so a license review happens in the pull request that introduces it
 * rather than during a customer's own review.
 *
 * Reads the lockfile for the set and `node_modules` for each package's declared
 * license, which is the tree `npm ci` just installed. Deliberately not a
 * downloaded license scanner: a required gate that fetches an unpinned package
 * from the registry at run time is outside the lockfile and outside this
 * repository's own dependency-quarantine window, which is the opposite of what
 * a supply-chain check is for.
 *
 * The published package has no production dependencies, so this covers the
 * authoring and build toolchain. That is the whole installed tree, and it is
 * what a contributor and CI actually execute.
 *
 * Usage:
 *
 *     node scripts/check-dependency-licenses.mjs [--lockfile=PATH] [--modules=PATH]
 * @module
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { nameFromLockfilePath } from './lib/lockfile.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Licenses this project accepts anywhere, redistribution included: permissive,
 * non-reciprocal, and compatible with shipping an Apache-2.0 package. A package
 * under anything else is not rejected forever; it is rejected until someone
 * decides deliberately and adds it to one of these two sets.
 */
const ALLOWED_ANYWHERE = new Set([
    '0BSD',
    'Apache-2.0',
    'BlueOak-1.0.0',
    'BSD-2-Clause',
    'BSD-3-Clause',
    'CC-BY-4.0',
    'CC0-1.0',
    'ISC',
    'MIT',
    'Python-2.0',
    'Unlicense',
]);

/**
 * Licenses accepted only for build and authoring tooling, which this package
 * runs but never redistributes. File-level reciprocal terms bind whoever
 * distributes the covered files; a devDependency is not in the tarball, is not
 * in a consumer's install, and so never puts a consumer under them.
 *
 * A production dependency is held to {@link ALLOWED_ANYWHERE} instead. The
 * published package has none today, and this set is what keeps that from
 * quietly becoming the wrong kind of dependency later.
 */
const ALLOWED_BUILD_ONLY = new Set(['MPL-2.0']);

/** First-party packages are EzClassify software, not a third-party license question. */
const FIRST_PARTY_PREFIX = '@ezclassify/';

function parseArguments(argv) {
    const options = {};
    for (const argument of argv) {
        const match = /^--(lockfile|modules)=(.+)$/.exec(argument);
        if (!match) {
            throw new Error(
                `Unrecognized argument "${argument}". Usage: check-dependency-licenses.mjs [--lockfile=PATH] [--modules=PATH]`,
            );
        }
        options[match[1]] = match[2];
    }
    return options;
}

/**
 * The license a package declares, read from the copy on disk at the lockfile's
 * own path so a nested version is read as itself.
 *
 * @param {string} modulesRoot - Directory holding the installed tree.
 * @param {string} lockPath - The lockfile key, relative to the package root.
 * @returns {string | null} An SPDX expression, or null when none is declared.
 */
function declaredLicense(modulesRoot, lockPath) {
    let manifest;
    try {
        manifest = JSON.parse(readFileSync(join(modulesRoot, lockPath, 'package.json'), 'utf8'));
    } catch {
        return null;
    }
    if (typeof manifest.license === 'string') return manifest.license;
    // The retired `licenses` array form still appears in older packages.
    if (Array.isArray(manifest.licenses)) {
        const named = manifest.licenses.map((entry) => entry?.type).filter(Boolean);
        if (named.length > 0) return named.join(' OR ');
    }
    return null;
}

/**
 * Is this expression satisfied by the given allowed set?
 *
 * Handles the two SPDX compound forms that appear in practice: `A OR B` passes
 * when either side does, `A AND B` only when both do. Anything more elaborate
 * is left to fail, because it deserves a human read anyway.
 *
 * @param {string} expression - An SPDX license expression.
 * @param {Set<string>} allowed - Identifiers accepted in this position.
 * @returns {boolean}
 */
function isAllowed(expression, allowed) {
    const cleaned = expression.replace(/[()]/g, ' ').trim();
    if (/\bOR\b/.test(cleaned)) {
        return cleaned.split(/\bOR\b/).some((part) => isAllowed(part, allowed));
    }
    if (/\bAND\b/.test(cleaned)) {
        return cleaned.split(/\bAND\b/).every((part) => isAllowed(part, allowed));
    }
    return allowed.has(cleaned.trim());
}

function main() {
    const options = parseArguments(process.argv.slice(2));
    const lockfilePath = resolve(options.lockfile ?? join(repositoryRoot, 'package-lock.json'));
    const modulesRoot = resolve(options.modules ?? repositoryRoot);

    const lockfile = JSON.parse(readFileSync(lockfilePath, 'utf8'));
    const problems = [];
    let inspected = 0;

    for (const [lockPath, entry] of Object.entries(lockfile.packages ?? {})) {
        if (lockPath === '' || entry.link) continue;
        const name = entry.name ?? nameFromLockfilePath(lockPath);
        if (!name || name.startsWith(FIRST_PARTY_PREFIX)) continue;

        inspected += 1;
        const buildOnly = entry.dev === true;
        const allowed = buildOnly
            ? new Set([...ALLOWED_ANYWHERE, ...ALLOWED_BUILD_ONLY])
            : ALLOWED_ANYWHERE;
        // A lockfile `license` is only usable when it is a string. Anything
        // else falls through to the installed copy, so a malformed entry
        // produces a named failure rather than a crash inside the gate.
        const license =
            typeof entry.license === 'string'
                ? entry.license
                : declaredLicense(modulesRoot, lockPath);
        if (license === null) {
            problems.push(`${name}@${entry.version ?? '?'} declares no license`);
        } else if (!isAllowed(license, allowed)) {
            problems.push(
                `${name}@${entry.version ?? '?'} is ${license}` +
                    (buildOnly ? '' : ' (a redistributed dependency, held to the stricter set)'),
            );
        }
    }

    if (problems.length > 0) {
        console.error(
            `Dependency licenses: ${problems.length} of ${inspected} package(s) are outside the allowed set.`,
        );
        for (const problem of problems) console.error(`  ${problem}`);
        console.error(
            `Allowed anywhere: ${[...ALLOWED_ANYWHERE].join(', ')}. ` +
                `Allowed for build tooling only: ${[...ALLOWED_BUILD_ONLY].join(', ')}. ` +
                'Adding to either set is a deliberate decision, not a CI fix.',
        );
        process.exitCode = 1;
        return;
    }

    console.log(
        `Dependency licenses passed: all ${inspected} third-party package(s) declare an allowed license.`,
    );
}

main();
