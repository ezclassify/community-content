#!/usr/bin/env node
/**
 * Dependency quarantine gate.
 *
 * Refuses third-party packages that were published inside a quarantine window,
 * so a freshly compromised release has to sit on the registry for a while
 * before it can enter this repository's dependency tree.
 *
 * This is deliberately NOT npm's `min-release-age` setting. That setting is
 * tree-wide with no way to exempt a scope, so putting it in a committed
 * `.npmrc` also quarantines our own first-party packages: a package published
 * minutes ago fails to install with ETARGET, which breaks the ordinary
 * cross-repository loop of publishing a library and refreshing its consumer.
 * The window belongs on third-party intake only, so the check lives here where
 * it can tell the two apart.
 *
 * Reads the lockfile rather than the manifests: the lockfile names the exact
 * versions that would be installed, including transitive ones, which is the set
 * that actually matters.
 *
 * Usage:
 *
 *     node scripts/check-dependency-age.mjs [--days=N] [--lockfile=PATH] [--registry=URL] [--first-party-registry=URL,URL]
 *
 * Each flag also has an environment form, which is what the tests use:
 * `EZCLASSIFY_DEPENDENCY_AGE_DAYS`, `EZCLASSIFY_DEPENDENCY_AGE_LOCKFILE`,
 * `EZCLASSIFY_DEPENDENCY_AGE_REGISTRY` (the registry asked about an entry whose
 * lockfile record carries no `resolved` URL), and
 * `EZCLASSIFY_DEPENDENCY_AGE_FIRST_PARTY_REGISTRIES` (comma-separated origins
 * trusted to serve `@ezclassify/*`; see `resolveFirstPartyRegistries`).
 * @module
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { nameFromLockfilePath } from './lib/lockfile.mjs';

/**
 * Default quarantine window. A week is long enough that a malicious release has
 * usually been reported and unpublished, and short enough that ordinary
 * upgrades are not held up for a sprint.
 */
const DEFAULT_QUARANTINE_DAYS = 7;

/**
 * Package-name prefix owned by this project. A name alone is NOT sufficient
 * for trust: any registry can serve a package under this prefix, so a name
 * match says nothing about who published it. Exemption requires the name AND
 * the serving registry to both be ours; see `resolveFirstPartyRegistries` and
 * `collectThirdPartyPackages`.
 */
const FIRST_PARTY_PREFIX = '@ezclassify/';

const MILLISECONDS_PER_DAY = 86_400_000;

/**
 * Registry consulted for an entry whose lockfile record carries no `resolved`
 * URL, which is every third-party entry when the lockfile was written with
 * `--package-lock-only`, and every first-party entry after `deps:relock`
 * normalizes its origin away.
 */
const DEFAULT_REGISTRY = 'https://registry.npmjs.org';

/**
 * How long one packument request may take, and how many may be in flight.
 *
 * A required CI step must not hang on a registry that accepts a connection and
 * says nothing, and it must not walk a few hundred packages one round trip at
 * a time. The concurrency is modest on purpose: this is a polite read of a
 * public registry, not a load test.
 */
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_CONCURRENT_REQUESTS = 8;
const MAX_ATTEMPTS = 3;

/**
 * Registry that mirrors this project's own packages when npm config does not
 * say otherwise (CI's `.npmrc` points `@ezclassify:registry` here). Included
 * unconditionally so the check still works before an environment has
 * configured the scope locally.
 */
const GITHUB_PACKAGES_REGISTRY = 'https://npm.pkg.github.com';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function parseArguments(argv) {
    const options = {};
    for (const argument of argv) {
        const match = /^--(days|lockfile|registry|first-party-registry)=(.+)$/.exec(argument);
        if (!match) {
            throw new Error(
                `Unrecognized argument "${argument}". Usage: check-dependency-age.mjs [--days=N] [--lockfile=PATH] [--registry=URL] [--first-party-registry=URL,URL]`,
            );
        }
        options[match[1]] = match[2];
    }
    return options;
}

function resolveQuarantineDays(options) {
    const raw =
        options.days ??
        process.env['EZCLASSIFY_DEPENDENCY_AGE_DAYS'] ??
        String(DEFAULT_QUARANTINE_DAYS);
    const days = Number(raw);
    if (!Number.isFinite(days) || days < 0) {
        throw new Error(`Quarantine window must be a non-negative number of days, got "${raw}".`);
    }
    return days;
}

function resolveLockfilePath(options) {
    const raw =
        options.lockfile ??
        process.env['EZCLASSIFY_DEPENDENCY_AGE_LOCKFILE'] ??
        resolve(repositoryRoot, 'package-lock.json');
    return resolve(raw);
}

function resolveDefaultRegistry(options) {
    const raw =
        options.registry ?? process.env['EZCLASSIFY_DEPENDENCY_AGE_REGISTRY'] ?? DEFAULT_REGISTRY;
    return raw.replace(/\/+$/, '');
}

/**
 * Registries trusted to serve `@ezclassify/*`. An explicit override (flag or
 * env, what the tests use) replaces the lookup. Otherwise this asks npm what
 * `@ezclassify:registry` is actually configured to in the running
 * environment (Verdaccio locally, GH Packages in CI's token lane) and adds
 * the GH Packages origin as a fixed fallback.
 *
 * Public npm is a valid first-party origin when configured for the scope.
 * A matching name from a different resolved origin remains quarantined.
 */
function resolveFirstPartyRegistries(options) {
    const raw =
        options['first-party-registry'] ??
        process.env['EZCLASSIFY_DEPENDENCY_AGE_FIRST_PARTY_REGISTRIES'];
    const registries = new Set();
    if (raw) {
        for (const origin of raw.split(',')) {
            const trimmed = origin.trim().replace(/\/+$/, '');
            if (trimmed) registries.add(trimmed);
        }
    } else {
        const configured = readConfiguredFirstPartyRegistry();
        if (configured) registries.add(configured);
        registries.add(GITHUB_PACKAGES_REGISTRY);
    }
    return [...registries];
}

/**
 * The one recognized env var for naming a trusted first-party registry. Kept
 * as a constant so `assertNoStrayTrustEnvVars` and `resolveFirstPartyRegistries`
 * cannot drift apart on the name.
 */
const FIRST_PARTY_TRUST_ENV_VAR = 'EZCLASSIFY_DEPENDENCY_AGE_FIRST_PARTY_REGISTRIES';

/**
 * Refuses to run silently trusting nothing when the environment set a
 * differently-named variable meant to convey the same thing (a typo, a name
 * copied from another project, a stale CI secret). Without this, a misnamed
 * var is read as "unset" and this check silently falls back to npm config /
 * GH Packages, exempting nothing the operator intended to exempt. Worse, it
 * could exempt the wrong thing if the misnamed var happened to also be read
 * by some other tool. Fail loud instead of guessing.
 */
function assertNoStrayTrustEnvVars() {
    const stray = Object.keys(process.env).filter(
        (key) =>
            key.startsWith('EZCLASSIFY_') &&
            key.includes('FIRST_PARTY') &&
            key !== FIRST_PARTY_TRUST_ENV_VAR,
    );
    if (stray.length > 0) {
        throw new Error(
            `Unrecognized first-party trust env var(s): ${stray.join(', ')}. ` +
                `The only recognized name is ${FIRST_PARTY_TRUST_ENV_VAR}. Rename it, or this check would silently ignore your intent.`,
        );
    }
}

/**
 * Follow npm's scope registry, falling back to its general registry when the
 * scope has no override. A failed lookup leaves the known fallback origins.
 */
function readConfiguredFirstPartyRegistry() {
    try {
        for (const key of ['@ezclassify:registry', 'registry']) {
            const output = execFileSync('npm', ['config', 'get', key], {
                cwd: repositoryRoot,
                encoding: 'utf8',
            }).trim();
            if (output && output !== 'undefined' && output !== 'null')
                return output.replace(/\/+$/, '');
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Collect the registry packages a lockfile would install that are NOT
 * verifiably first-party.
 *
 * Skips the root entry, workspace packages and links, and git/file
 * dependencies (nothing to ask a registry about). Keyed by `name@version` so
 * a package pinned at two versions is checked at both.
 *
 * `resolved` is only consulted for the registry origin, never as a filter: a
 * lockfile written with `--package-lock-only` omits `resolved` on most
 * entries, and skipping those would silently drop the majority of the tree
 * from the check.
 *
 * Exemption requires BOTH the name to carry the first-party prefix AND the
 * resolved registry to be one this project trusts. A package literally named
 * `@ezclassify/*` served from anywhere else is not exempt. That is exactly
 * the case this check exists to catch.
 */
function collectThirdPartyPackages(lockfile, defaultRegistry, firstPartyRegistries) {
    const entries = new Map();
    const packages = lockfile.packages ?? {};
    // The fallback used for a name-prefixed-first-party entry with no
    // `resolved` (what `deps:relock --normalize` produces): assume it came
    // from the configured first-party registry. If none is known, use the
    // third-party default, which must still match the trusted origin list
    // before the entry can be exempted.
    const firstPartyFallbackRegistry = firstPartyRegistries[0] ?? defaultRegistry;
    for (const [path, entry] of Object.entries(packages)) {
        // The root entry, workspace packages (no `node_modules/` segment) and
        // links all describe local code.
        if (path === '' || entry.link === true) continue;
        if (!path.includes('node_modules/')) continue;
        if (typeof entry.version !== 'string') continue;
        const name = entry.name ?? nameFromLockfilePath(path);
        if (!name) continue;
        const isFirstPartyName = name.startsWith(FIRST_PARTY_PREFIX);
        const fallbackRegistry = isFirstPartyName ? firstPartyFallbackRegistry : defaultRegistry;
        const registry = registryOf(entry.resolved, fallbackRegistry);
        // A git, file, or link dependency has no registry to ask.
        if (registry === null) continue;
        const servedByFirstPartyRegistry = firstPartyRegistries.includes(registry);
        // Exemption requires BOTH the name and the resolved (or, for a
        // normalized first-party entry, the assumed) registry to be ours. A
        // package literally named @ezclassify/* served from anywhere else is
        // not exempt; a matching name alone proves nothing about its origin.
        if (isFirstPartyName && servedByFirstPartyRegistry) continue;
        entries.set(`${name}@${entry.version}`, {
            name,
            version: entry.version,
            registry,
        });
    }
    return [...entries.values()];
}

/**
 * Registry origin for a lockfile entry: the origin of its `resolved` tarball
 * when present, otherwise the configured default. Returns null for a non-http
 * source, which has no registry to query.
 */
function registryOf(resolved, defaultRegistry) {
    if (typeof resolved !== 'string') return defaultRegistry;
    let url;
    try {
        url = new URL(resolved);
    } catch {
        return null;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
}

/**
 * Fetch a package's publish times from its registry.
 *
 * Asks for the full packument: the abbreviated install document npm normally
 * uses omits per-version timestamps, which are the whole point here.
 */
async function fetchPublishTimes(registry, name) {
    const url = `${registry}/${name.replace('/', '%2f')}`;
    let lastTransportError;

    // A registry read is not the gate's subject: a connection reset on the way
    // to it should not fail a dependency that is perfectly old enough. A
    // refusal by the registry (any HTTP answer) is not retried, because
    // repeating it would say the same thing.
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        let response;
        try {
            response = await fetch(url, {
                headers: { accept: 'application/json' },
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            });
        } catch (cause) {
            lastTransportError = cause;
            if (attempt < MAX_ATTEMPTS) continue;
            throw new Error(
                `Could not reach ${registry} to check the publish date of ${name} in ${MAX_ATTEMPTS} attempts: ${cause instanceof Error ? cause.message : String(cause)}`,
                { cause },
            );
        }
        if (!response.ok) {
            throw new Error(
                `${registry} answered ${response.status} for ${name}; cannot confirm its publish date.`,
            );
        }
        const document = await response.json();
        const times = document?.time;
        if (!times || typeof times !== 'object') {
            throw new Error(
                `${registry} returned no publish times for ${name}; cannot confirm the quarantine window.`,
            );
        }
        return times;
    }
    // Unreachable: the loop either returns or throws on its last attempt.
    throw lastTransportError;
}

/**
 * Run one task per item with at most `limit` in flight, preserving the input
 * order in the result.
 *
 * @template T, R
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T) => Promise<R>} task
 * @returns {Promise<R[]>}
 */
async function mapWithConcurrency(items, limit, task) {
    const results = new Array(items.length);
    let next = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const index = next;
            next += 1;
            results[index] = await task(items[index]);
        }
    });
    await Promise.all(workers);
    return results;
}

async function main() {
    assertNoStrayTrustEnvVars();
    const options = parseArguments(process.argv.slice(2));
    const quarantineDays = resolveQuarantineDays(options);
    const lockfilePath = resolveLockfilePath(options);

    const defaultRegistry = resolveDefaultRegistry(options);
    const firstPartyRegistries = resolveFirstPartyRegistries(options);

    const lockfile = JSON.parse(readFileSync(lockfilePath, 'utf8'));
    const packages = collectThirdPartyPackages(lockfile, defaultRegistry, firstPartyRegistries);

    if (quarantineDays === 0) {
        console.log('Dependency quarantine window is 0 days; nothing to check.');
        return;
    }

    const cutoff = Date.now() - quarantineDays * MILLISECONDS_PER_DAY;
    const violations = [];
    const unknown = [];

    // One packument per registry+name, however many lockfile entries share it.
    // A plain space or comma would be ambiguous against real registry URLs and
    // package names; this separator cannot appear in either.
    const cacheKey = (entry) => `${entry.registry}::${entry.name}`;
    const wanted = [...new Map(packages.map((entry) => [cacheKey(entry), entry])).values()];

    // One unreachable package must not discard every violation already found:
    // each fetch resolves to its times or to the reason it has none, and the
    // reporting below runs over the whole set either way.
    const fetched = await mapWithConcurrency(wanted, MAX_CONCURRENT_REQUESTS, async (entry) => {
        try {
            return {
                key: cacheKey(entry),
                times: await fetchPublishTimes(entry.registry, entry.name),
            };
        } catch (error) {
            return {
                key: cacheKey(entry),
                reason: error instanceof Error ? error.message : String(error),
            };
        }
    });
    const timesByPackage = new Map(fetched.map((result) => [result.key, result]));

    for (const entry of packages) {
        const result = timesByPackage.get(cacheKey(entry));
        if (result.reason !== undefined) {
            unknown.push({ ...entry, reason: result.reason });
            continue;
        }
        const published = result.times[entry.version];
        if (typeof published !== 'string') {
            unknown.push({
                ...entry,
                reason: `${entry.registry} reports no publish date for ${entry.name}@${entry.version}.`,
            });
            continue;
        }
        const publishedAt = Date.parse(published);
        if (Number.isNaN(publishedAt)) {
            unknown.push({
                ...entry,
                reason: `${entry.registry} reports an unparseable publish date for ${entry.name}@${entry.version}.`,
            });
            continue;
        }
        if (publishedAt > cutoff) {
            violations.push({ ...entry, published });
        }
    }

    if (unknown.length > 0) {
        for (const entry of unknown) {
            console.error(`Dependency quarantine: ${entry.reason}`);
        }
        process.exitCode = 1;
    }

    if (violations.length > 0) {
        console.error(
            `Dependency quarantine: ${violations.length} third-party package(s) were published less than ${quarantineDays} day(s) ago.`,
        );
        for (const violation of violations) {
            console.error(
                `  ${violation.name}@${violation.version} published ${violation.published}`,
            );
        }
        console.error('Wait out the window, or pin an older version, before taking these in.');
        process.exitCode = 1;
    }

    if (process.exitCode) return;

    console.log(
        `Dependency quarantine passed: ${packages.length} third-party package(s) are all older than ${quarantineDays} day(s).`,
    );
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
