/**
 * The CLI pin: what `ezclassify-cli.json` may declare, and how a declared
 * source becomes a runnable `ezclassify`.
 *
 * Two scripts share this module so they cannot disagree about the pin.
 * `check-cli-pin.mjs` decides what may be committed. `resolve-cli.mjs` turns
 * what was committed into an executable, or fails loudly.
 *
 * The rule that matters: a configured pin is a promise that the behavioral
 * lane runs. Every way of failing to keep that promise is an error, never a
 * quiet fall-through to a skip: an unreachable download, a checksum that does
 * not match, an archive or image that holds no `ezclassify`. An unconfigured
 * pin resolves nothing and says so; the lane then needs a CLI supplied another
 * way.
 *
 * Both sources stay reachable without a network or a registry, which is also
 * how the failure modes are tested: an archive can be pinned by `file:` URL
 * (the air-gapped transfer path), and the container engine is whatever
 * `EZCLASSIFY_CONTAINER_ENGINE` names.
 * @module
 */
import { execFileSync, spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as https from 'node:https';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { REPO_ROOT, compareVersions } from './scheme-folder.mjs';

/** Pin filename, at the repository root. */
export const PIN_FILENAME = 'ezclassify-cli.json';

/** Absolute path of the committed pin. */
export const PIN_PATH = path.join(REPO_ROOT, PIN_FILENAME);

/** The executable name the pin is expected to deliver. */
export const CLI_NAME = 'ezclassify';

const VERSION = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const SHA256 = /^[0-9a-f]{64}$/;
const IMAGE_DIGEST = /^sha256:[0-9a-f]{64}$/;

/**
 * An OCI image reference: optional `host[:port]/`, a path, and an optional
 * tag. Deliberately narrow. The reference is written into a generated shell
 * script, so restricting it to the characters a reference may actually contain
 * keeps that generation a substitution rather than a parse.
 */
const IMAGE_REF =
    /^[A-Za-z0-9][A-Za-z0-9._-]*(?::\d+)?(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*(?::[A-Za-z0-9][A-Za-z0-9._-]*)?$/;
const MAX_REDIRECTS = 5;

/**
 * How long one download may take, in milliseconds. A CI job that hangs on a
 * half-open socket burns its whole timeout budget and reports nothing useful;
 * a refusal after a minute names the URL that would not answer.
 */
const DOWNLOAD_TIMEOUT_MS = 60_000;

/** A pin that cannot be used, with a message written for a CI log reader. */
export class CliPinError extends Error {
    /** @param {string} message */
    constructor(message) {
        super(message);
        this.name = 'CliPinError';
    }
}

/**
 * Read and parse the pin file.
 *
 * @param {string} [pinPath] Defaults to the committed pin.
 * @returns {Record<string, any>}
 */
export function readPin(pinPath = PIN_PATH) {
    let raw;
    try {
        raw = fs.readFileSync(pinPath, 'utf-8');
    } catch (error) {
        throw new CliPinError(`could not read ${pinPath}: ${error.message}`);
    }
    try {
        return JSON.parse(raw);
    } catch (error) {
        throw new CliPinError(`${pinPath} is not valid JSON: ${error.message}`);
    }
}

/**
 * Everything wrong with a pin, as a list so one run reports all of it.
 *
 * `committed` applies the stricter rule the repository holds its own pin to:
 * a public archive is fetched over https. An operator resolving a locally
 * transferred archive may also use a `file:` URL; see {@link resolveArchive}.
 *
 * @param {Record<string, any>} pin
 * @param {{ committed?: boolean }} [options]
 * @returns {string[]}
 */
export function validatePin(pin, { committed = true } = {}) {
    const problems = [];

    for (const key of ['minimumVersion', 'testedVersion']) {
        if (typeof pin[key] !== 'string' || !VERSION.test(pin[key])) {
            problems.push(`${key} must be a version string, got ${JSON.stringify(pin[key])}`);
        }
    }
    if (
        VERSION.test(pin.minimumVersion ?? '') &&
        VERSION.test(pin.testedVersion ?? '') &&
        compareVersions(pin.testedVersion, pin.minimumVersion) < 0
    ) {
        problems.push(
            `testedVersion ${pin.testedVersion} is below minimumVersion ${pin.minimumVersion}`,
        );
    }

    const archive = pin.archive ?? {};
    if (archive.url || archive.sha256) {
        const schemes = committed ? ['https:'] : ['https:', 'file:'];
        if (typeof archive.url !== 'string' || !schemes.includes(urlScheme(archive.url))) {
            problems.push(
                `archive.url must be ${schemes.map((s) => `${s}//`).join(' or ')} when an archive is declared`,
            );
        }
        if (typeof archive.sha256 !== 'string' || !SHA256.test(archive.sha256)) {
            problems.push('archive.sha256 must be a 64-character hex digest');
        }
    }

    const image = pin.image ?? {};
    if (image.ref || image.digest) {
        if (typeof image.ref !== 'string' || !IMAGE_REF.test(image.ref)) {
            problems.push(
                'image.ref must be an image reference such as ghcr.io/ezclassify/cli or ghcr.io/ezclassify/cli:1.0.0',
            );
        }
        if (typeof image.digest !== 'string' || !IMAGE_DIGEST.test(image.digest)) {
            problems.push('image.digest must be a sha256:<hex> digest');
        }
    }

    return problems;
}

/**
 * The sources this pin declares, in the order the resolver prefers them. An
 * archive needs nothing but a download; an image needs a container engine.
 *
 * @param {Record<string, any>} pin
 * @returns {Array<'archive' | 'image'>}
 */
export function declaredSources(pin) {
    const sources = [];
    if (pin.archive?.url) sources.push('archive');
    if (pin.image?.ref) sources.push('image');
    return sources;
}

/**
 * @param {string} value
 * @returns {string} The URL scheme with its colon, or an empty string.
 */
function urlScheme(value) {
    try {
        return new URL(value).protocol;
    } catch {
        return '';
    }
}

/**
 * Download to a file over https, following redirects. Release archives are
 * routinely served by a redirect to object storage, so this follows up to
 * `MAX_REDIRECTS` of them.
 *
 * A `file:` URL is copied instead. That is the air-gapped path: the archive
 * arrived through the operator's own software transfer process and the
 * checksum below is what proves it is the pinned artifact.
 *
 * Every failure removes a partly written destination, so a caller that retries
 * or falls through to the checksum never reads a truncated archive as if it
 * were the whole one.
 *
 * @param {string} url
 * @param {string} destination
 * @returns {Promise<void>}
 */
export async function downloadToFile(url, destination) {
    if (urlScheme(url) === 'file:') {
        await fs.promises.copyFile(fileURLToPath(url), destination);
        return;
    }
    try {
        await fetchToFile(url, destination);
    } catch (error) {
        await fs.promises.rm(destination, { force: true });
        throw error;
    }
}

/**
 * The https half of {@link downloadToFile}: follow redirects, then stream the
 * body to disk. Kept separate so the caller owns the partial-file cleanup for
 * every way this can fail.
 *
 * @param {string} url
 * @param {string} destination
 * @returns {Promise<void>}
 */
async function fetchToFile(url, destination) {
    let current = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
        // A redirect may cross hosts (release archives are routinely served
        // from object storage), but never schemes: a pinned artifact is
        // fetched over https or not at all.
        if (urlScheme(current) !== 'https:') {
            throw new Error(`refusing to follow a non-https redirect to ${current}`);
        }
        const response = await new Promise((resolve, reject) => {
            const request = https.get(current, { timeout: DOWNLOAD_TIMEOUT_MS }, resolve);
            request.on('timeout', () => {
                request.destroy(
                    new Error(`no response from ${current} within ${DOWNLOAD_TIMEOUT_MS}ms`),
                );
            });
            request.on('error', reject);
        });
        const status = response.statusCode ?? 0;
        if (status >= 300 && status < 400 && response.headers.location) {
            response.resume();
            current = new URL(response.headers.location, current).toString();
            continue;
        }
        if (status !== 200) {
            response.resume();
            throw new Error(`HTTP ${status} from ${current}`);
        }
        response.setTimeout(DOWNLOAD_TIMEOUT_MS, () => {
            response.destroy(
                new Error(`transfer from ${current} stalled for ${DOWNLOAD_TIMEOUT_MS}ms`),
            );
        });
        await new Promise((resolve, reject) => {
            const file = fs.createWriteStream(destination);
            response.pipe(file);
            file.on('finish', () => file.close((error) => (error ? reject(error) : resolve())));
            file.on('error', reject);
            response.on('error', reject);
        });
        return;
    }
    throw new Error(`more than ${MAX_REDIRECTS} redirects starting at ${url}`);
}

/** Chunk size for {@link sha256File}. */
const HASH_CHUNK_BYTES = 1 << 20;

/**
 * Checksum a file without holding it in memory. A release archive is tens of
 * megabytes today and nothing bounds what it may be later, so it is read in
 * chunks rather than buffered whole.
 *
 * @param {string} file
 * @returns {string} Lowercase hex sha256 of the file's bytes.
 */
export function sha256File(file) {
    const hash = crypto.createHash('sha256');
    const buffer = Buffer.allocUnsafe(HASH_CHUNK_BYTES);
    const handle = fs.openSync(file, 'r');
    try {
        let read = 0;
        while ((read = fs.readSync(handle, buffer, 0, HASH_CHUNK_BYTES, null)) > 0) {
            hash.update(buffer.subarray(0, read));
        }
    } finally {
        fs.closeSync(handle);
    }
    return hash.digest('hex');
}

/**
 * Depth-first search for a regular file with the given name. Entries are
 * sorted so two runs over the same tree pick the same file.
 *
 * @param {string} directory
 * @param {string} name
 * @returns {string | undefined} Absolute path, or undefined when absent.
 */
export function findExecutable(directory, name = CLI_NAME) {
    /** @type {fs.Dirent[]} */
    let entries;
    try {
        entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
        return undefined;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
        const full = path.join(directory, entry.name);
        if (entry.isFile() && entry.name === name) return full;
    }
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const found = findExecutable(path.join(directory, entry.name), name);
        if (found) return found;
    }
    return undefined;
}

/** Default archive extraction: gzipped tar through the system `tar`. */
function extractArchive(archivePath, into) {
    if (!/\.(tar\.gz|tgz)$/.test(archivePath)) {
        throw new Error(`unsupported archive format: ${path.basename(archivePath)}`);
    }
    fs.mkdirSync(into, { recursive: true });
    execFileSync('tar', ['-xzf', archivePath, '-C', into], { stdio: 'pipe' });
}

/**
 * Default container engine call. Docker and Podman take the same arguments
 * here, and neither is required to be the one installed: the product does not
 * pick a customer's container runtime, and neither does its CI.
 *
 * @param {string[]} args
 * @returns {{ status: number, stdout: string, stderr: string }}
 */
function runContainerEngine(args) {
    const engine = process.env['EZCLASSIFY_CONTAINER_ENGINE'] || detectContainerEngine();
    if (!engine) {
        return { status: 127, stdout: '', stderr: 'no container engine found (docker or podman)' };
    }
    const result = spawnSync(engine, args, { encoding: 'utf-8' });
    return {
        status: result.status ?? 1,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? String(result.error ?? ''),
    };
}

/** @returns {string | undefined} */
function detectContainerEngine() {
    for (const candidate of ['docker', 'podman']) {
        if (spawnSync(candidate, ['--version'], { stdio: 'ignore' }).status === 0) return candidate;
    }
    return undefined;
}

/**
 * Fetch, verify, and unpack the pinned archive.
 *
 * @param {Record<string, any>} pin
 * @param {object} options
 * @param {string} options.workDir Scratch directory; created if absent.
 * @returns {Promise<string>} Absolute path of the CLI.
 */
export async function resolveArchive(pin, options) {
    const { url, sha256 } = pin.archive;
    const workDir = options.workDir;

    fs.mkdirSync(workDir, { recursive: true });
    const archivePath = path.join(workDir, path.basename(new URL(url).pathname) || 'cli.tar.gz');

    try {
        await downloadToFile(url, archivePath);
    } catch (error) {
        throw new CliPinError(
            `the pinned CLI archive could not be downloaded from ${url}: ${error.message}`,
        );
    }

    const actual = sha256File(archivePath);
    if (actual !== sha256) {
        throw new CliPinError(
            `the pinned CLI archive from ${url} does not match its checksum: expected ${sha256}, got ${actual}`,
        );
    }

    const extracted = path.join(workDir, 'archive');
    try {
        extractArchive(archivePath, extracted);
    } catch (error) {
        throw new CliPinError(
            `the pinned CLI archive from ${url} could not be unpacked: ${error.message}`,
        );
    }

    const cli = findExecutable(extracted);
    if (!cli) {
        throw new CliPinError(
            `the pinned CLI archive from ${url} contains no ${CLI_NAME} executable`,
        );
    }
    fs.chmodSync(cli, 0o755);

    const probed = probeExecutable(cli);
    if (probed.status !== 0) {
        throw new CliPinError(
            `${cli} came out of the pinned archive but does not run: ${probed.stderr.trim() || `exit ${probed.status}`}`,
        );
    }
    return cli;
}

/**
 * Pull the pinned image by digest and write a wrapper that runs the CLI out of
 * it. The wrapper is what the suite runner executes, so an image pin and an
 * archive pin reach the runner the same way.
 *
 * @param {Record<string, any>} pin
 * @param {object} options
 * @param {string} options.workDir
 * @param {string} [options.mount] Directory the CLI must see; defaults to the repository root.
 * @returns {Promise<string>} Absolute path of the wrapper.
 */
export async function resolveImage(pin, options) {
    const { ref, digest } = pin.image;
    const pinned = `${ref}@${digest}`;
    const workDir = options.workDir;
    const mount = options.mount ?? REPO_ROOT;

    const pull = runContainerEngine(['pull', pinned]);
    if (pull.status !== 0) {
        throw new CliPinError(
            `the pinned CLI image ${pinned} could not be pulled: ${pull.stderr.trim() || `exit ${pull.status}`}`,
        );
    }

    const inspect = runContainerEngine([
        'image',
        'inspect',
        pinned,
        '--format',
        '{{json .RepoDigests}}',
    ]);
    if (inspect.status !== 0 || !inspect.stdout.includes(digest)) {
        throw new CliPinError(
            `the local image for ${ref} does not carry the pinned digest ${digest}; refusing to run it`,
        );
    }

    const version = runContainerEngine([
        'run',
        '--rm',
        '--entrypoint',
        CLI_NAME,
        pinned,
        '--version',
    ]);
    if (version.status !== 0) {
        throw new CliPinError(
            `the pinned CLI image ${pinned} provides no runnable ${CLI_NAME}: ${version.stderr.trim() || `exit ${version.status}`}`,
        );
    }

    const engine = process.env['EZCLASSIFY_CONTAINER_ENGINE'] || detectContainerEngine();
    fs.mkdirSync(workDir, { recursive: true });
    // Every value below is single-quoted in the generated script. `validatePin`
    // has already constrained `ref` and `digest`; the engine path and the mount
    // come from the environment, and quoting is what keeps a path with a space
    // in it one argument.
    const wrapper = path.join(workDir, CLI_NAME);
    fs.writeFileSync(
        wrapper,
        [
            '#!/bin/sh',
            '# Generated by scripts/resolve-cli.mjs from the image pin in',
            `# ${PIN_FILENAME}. Runs the CLI out of the pinned image by digest,`,
            '# with the repository mounted so relative paths mean the same thing',
            '# they do for an unpacked archive.',
            'set -e',
            `exec ${shellQuote(engine)} run --rm \\`,
            '  --user "$(id -u):$(id -g)" \\',
            `  --volume ${shellQuote(`${mount}:/workspace`)} \\`,
            '  --workdir /workspace \\',
            `  --entrypoint ${shellQuote(CLI_NAME)} \\`,
            `  ${shellQuote(pinned)} "$@"`,
            '',
        ].join('\n'),
        { mode: 0o755 },
    );
    return wrapper;
}

/**
 * Single-quote a value for the generated `/bin/sh` wrapper.
 *
 * @param {string} value
 * @returns {string} The value as one shell word.
 */
function shellQuote(value) {
    return `'${String(value).replaceAll("'", `'\\''`)}'`;
}

/** Default runnability probe: the CLI answers `--version`. */
function probeExecutable(cli) {
    const isScript = /\.[cm]?js$/.test(cli);
    const result = isScript
        ? spawnSync(process.execPath, [cli, '--version'], { encoding: 'utf-8' })
        : spawnSync(cli, ['--version'], { encoding: 'utf-8' });
    return {
        status: result.status ?? 1,
        stderr: result.stderr ?? String(result.error ?? ''),
    };
}

/**
 * Resolve the pin to a runnable CLI.
 *
 * @param {Record<string, any>} pin
 * @param {object} [options]
 * @param {string} [options.workDir] Scratch directory; defaults to `.cli` at the repository root.
 * @param {string} [options.mount] For an image pin, the directory the CLI must see.
 * @returns {Promise<{ status: 'resolved', source: 'archive' | 'image', cli: string }
 *   | { status: 'unconfigured' }>}
 * @throws {CliPinError} When the pin declares a source it cannot deliver.
 */
export async function resolvePinnedCli(pin, options = {}) {
    const problems = validatePin(pin, { committed: false });
    if (problems.length > 0) {
        throw new CliPinError(`${PIN_FILENAME} is not usable: ${problems.join('; ')}`);
    }

    const sources = declaredSources(pin);
    if (sources.length === 0) return { status: 'unconfigured' };

    const workDir = options.workDir ?? path.join(REPO_ROOT, '.cli');
    const source = sources[0];
    const cli =
        source === 'archive'
            ? await resolveArchive(pin, { ...options, workDir })
            : await resolveImage(pin, { ...options, workDir });
    return { status: 'resolved', source, cli };
}
