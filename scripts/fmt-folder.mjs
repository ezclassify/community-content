#!/usr/bin/env node
/**
 * Regenerate the scheme-folder manifest from the files on disk.
 *
 * Library-level equivalent of `ezclassify scheme fmt scheme-folder`, but built
 * on public packages only, so a contributor with a clean clone can run it. The
 * work is file accounting: read each definition's in-file `id` and `version`,
 * normalize its filename to `<id>@<version>.yaml`, and rewrite
 * `scheme-folder/scheme-folder.yaml` to index exactly what is there.
 *
 * The prior manifest's identity fields (`name`, `format`, `description`) and
 * per-entry intent (`latest`, `publish`) are carried over: those are authored
 * decisions, not facts about the directory, and regenerating an index should
 * not quietly discard them.
 *
 * Exits non-zero if two definitions would claim the same `<id>@<version>`.
 * @module
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
    FOLDER,
    MANIFEST_FILENAME,
    REPO_ROOT,
    SCHEME_FOLDER_FORMAT,
    TYPE_DIRS,
    compareVersions,
    listTypeDirFiles,
    readManifest,
    serializeManifest,
    unwrapDefinition,
} from './lib/scheme-folder.mjs';
import { parseDocument } from '@ezclassify/validator';

const manifestPath = path.join(FOLDER, MANIFEST_FILENAME);
const prior = fs.existsSync(manifestPath) ? readManifest(FOLDER) : {};

/**
 * Index one type directory: normalize filenames, group versions by id, and
 * carry the prior entry's `latest` / `publish` intent forward when it still
 * describes something on disk.
 *
 * @param {{kind: string, dir: string, manifestKey: string}} type
 * @returns {Array<Record<string, unknown>>} Manifest entries, sorted by id.
 */
function collect({ kind, dir, manifestKey }) {
    const byId = new Map();

    for (const file of listTypeDirFiles(FOLDER, dir)) {
        const parsed = parseDocument(file);
        const doc = unwrapDefinition(parsed, kind);
        const want = `${doc.id}@${doc.version}.yaml`;

        if (path.basename(file) !== want) {
            const dest = path.join(path.dirname(file), want);
            // renameSync overwrites silently, so two sources that resolve to
            // the same id@version would clobber each other with no error.
            // Refuse instead: losing a scheme to a rename is not a formatting
            // outcome anyone wants.
            if (fs.existsSync(dest)) {
                console.error(
                    `[fmt] cannot rename ${path.basename(file)} to ${want}: ${want} already exists.`,
                );
                console.error(
                    `[fmt] two ${kind} definitions resolve to the same id@version. Resolve the duplicate first.`,
                );
                process.exit(1);
            }
            fs.renameSync(file, dest);
            console.log(`[fmt] renamed ${path.relative(REPO_ROOT, file)} to ${want}`);
        }

        const versions = byId.get(doc.id) ?? new Set();
        versions.add(doc.version);
        byId.set(doc.id, versions);
    }

    const priorEntries = prior[manifestKey] ?? [];

    return [...byId.entries()]
        .map(([id, versions]) => {
            const sorted = [...versions].sort(compareVersions);
            const priorEntry = priorEntries.find((e) => e.id === id);
            const entry = { id, versions: sorted };
            if (priorEntry?.latest && sorted.includes(priorEntry.latest)) {
                entry.latest = priorEntry.latest;
            }
            if (kind === 'context' && priorEntry?.publish === false) {
                entry.publish = false;
            }
            return entry;
        })
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

const manifest = {
    name: prior.name ?? path.basename(FOLDER),
    format: prior.format ?? SCHEME_FOLDER_FORMAT,
};
if (prior.description) manifest.description = prior.description;
for (const type of TYPE_DIRS) {
    manifest[type.manifestKey] = collect(type);
}

fs.writeFileSync(manifestPath, serializeManifest(manifest), 'utf-8');

const counts = TYPE_DIRS.map(
    ({ manifestKey }) => `${manifest[manifestKey].length} ${manifestKey}`,
).join(', ');
console.log(`[fmt] rewrote ${path.relative(REPO_ROOT, manifestPath)} (${counts})`);
