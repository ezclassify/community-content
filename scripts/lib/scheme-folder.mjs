/**
 * The scheme-folder convention, implemented from public packages only.
 *
 * This repository is public content. It cannot depend on the EzClassify engine,
 * so everything here is deliberately limited to what a document's shape and a
 * directory listing can prove: parse the YAML, check it against the published
 * JSON Schema through `@ezclassify/validator`, and do the file accounting.
 *
 * The EzClassify CLI runs the behavioral suites in
 * `scheme-folder/test-suites/` to check their asserted outcomes.
 * See CONTRIBUTING.md.
 *
 * The three folder commands (`validate`, `fmt`, `build`) share this module so
 * they cannot disagree about what the folder holds.
 * @module
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import semver from 'semver';
import { parseDocument, validateFile } from '@ezclassify/validator';

/** Absolute path of the repository root. */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Absolute path of the scheme folder this repository publishes. */
export const FOLDER = path.join(REPO_ROOT, 'scheme-folder');

/** The convention version this repository's manifest declares. */
export const SCHEME_FOLDER_FORMAT = 1;

/** Manifest filename, per the convention. */
export const MANIFEST_FILENAME = 'scheme-folder.yaml';

/**
 * The four component kinds a scheme folder can hold, each in its own directory.
 * The directory name is the plural of the kind, and the manifest key matches.
 */
export const TYPE_DIRS = [
    { kind: 'scheme', dir: 'schemes', manifestKey: 'schemes' },
    { kind: 'guide', dir: 'guides', manifestKey: 'guides' },
    { kind: 'access', dir: 'accesses', manifestKey: 'accesses' },
    { kind: 'context', dir: 'contexts', manifestKey: 'contexts' },
];

/** Definition filenames are `<id>@<version>.yaml`. */
export const FILENAME_PATTERN = /^(.+)@([^@]+)\.ya?ml$/;

/**
 * Compare two versions by semver precedence, lexicographically when either one
 * is not a valid semver version.
 *
 * A prerelease sorts below the release it leads to, which is what makes the
 * pin's minimum-version gate mean something: `1.0.0-rc.1` is below a declared
 * minimum of `1.0.0`, and a gate that called them equal would take the release
 * candidate. Build metadata is ignored, as semver requires.
 *
 * The lexicographic fallback is deliberate. A scheme version is authored text
 * and this comparator runs during validation, so a malformed one has to order
 * somehow rather than throw before the validator can report it.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} Negative when `a` sorts first.
 */
export function compareVersions(a, b) {
    if (!semver.valid(a) || !semver.valid(b)) return a < b ? -1 : a > b ? 1 : 0;
    return semver.compare(a, b);
}

/** Highest version in a list, by {@link compareVersions}. */
export function highestVersion(versions) {
    return [...versions].sort(compareVersions).at(-1);
}

/**
 * List the definition files in one type directory, sorted by filename.
 *
 * @param {string} folder Scheme-folder root.
 * @param {string} dir Type directory name, e.g. `schemes`.
 * @returns {string[]} Absolute paths.
 */
export function listTypeDirFiles(folder, dir) {
    const typeDir = path.join(folder, dir);
    if (!fs.existsSync(typeDir)) return [];
    return fs
        .readdirSync(typeDir)
        .filter((name) => /\.ya?ml$/i.test(name))
        .sort()
        .map((name) => path.join(typeDir, name));
}

/**
 * Read and parse the folder manifest.
 *
 * @param {string} folder Scheme-folder root.
 * @returns {Record<string, unknown>} The parsed manifest.
 */
export function readManifest(folder) {
    return parseDocument(path.join(folder, MANIFEST_FILENAME));
}

/**
 * Read every definition on disk, grouped by kind.
 *
 * Each entry carries the bare definition as `doc` and the file's parsed
 * document, envelope included, as `document`. Shape validation is the caller's business; this is a
 * reader, not a gate.
 *
 * @param {string} folder Scheme-folder root.
 * @returns {Record<string, Array<{id: string, version: string, file: string, fileName: string, doc: Record<string, unknown>, document: Record<string, unknown>}>>}
 *   Keyed by kind.
 */
export function readDefinitions(folder) {
    const out = {};
    for (const { kind, dir } of TYPE_DIRS) {
        out[kind] = [];
        for (const file of listTypeDirFiles(folder, dir)) {
            const parsed = parseDocument(file);
            const doc = unwrapDefinition(parsed, kind);
            out[kind].push({
                id: doc.id,
                version: doc.version,
                file,
                fileName: path.basename(file),
                doc,
                document: parsed,
            });
        }
    }
    return out;
}

/**
 * Validate one definition file against its published JSON Schema.
 *
 * @param {string} file Absolute path.
 * @param {string} kind Component kind.
 * @returns {{ok: boolean, errors: Array<{path?: string, message: string}>}}
 */
export function validateDefinitionFile(file, kind) {
    return validateFile(file, kind);
}

/**
 * Serialize a manifest to the convention's canonical YAML.
 *
 * Key order is fixed rather than sorted: a reader scanning the file wants
 * identity first and inventory after, and the four component lists always
 * appear so an empty one is visibly empty rather than absent.
 *
 * @param {Record<string, unknown>} manifest
 * @returns {string} YAML text, newline-terminated.
 */
export function serializeManifest(manifest) {
    const out = {
        name: manifest.name,
        format: manifest.format,
    };
    if (manifest.description) out.description = manifest.description;

    const emit = (entries) =>
        [...(entries ?? [])]
            .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
            .map((entry) => {
                const row = {
                    id: entry.id,
                    versions: [...entry.versions].sort(compareVersions),
                };
                if (entry.latest) row.latest = entry.latest;
                if (entry.publish === false) row.publish = false;
                return row;
            });

    for (const { manifestKey } of TYPE_DIRS) {
        out[manifestKey] = emit(manifest[manifestKey]);
    }

    return yaml.dump(out, { lineWidth: 100, noRefs: true });
}

/** True for a non-null, non-array object. */
export function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Strip the `{ <kind>: {...} }` envelope from a parsed definition. Every
 * definition file carries its envelope, and every folder command reads `id` and
 * `version` off the bare object inside it.
 *
 * @param {Record<string, unknown>} parsed A parsed definition file.
 * @param {string} kind Component kind, e.g. `scheme`.
 * @returns {Record<string, unknown>} The bare definition.
 * @throws {Error} When the file has no top-level `<kind>:` envelope.
 */
export function unwrapDefinition(parsed, kind) {
    if (!isPlainObject(parsed) || !isPlainObject(parsed[kind])) {
        throw new Error(`a ${kind} definition must be wrapped in a top-level \`${kind}:\` key`);
    }
    return parsed[kind];
}
