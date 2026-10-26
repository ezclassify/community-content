#!/usr/bin/env node
/**
 * Validate this repository's scheme folder using only public packages.
 *
 * Three checks run here, and they are deliberately different in kind:
 *
 * 1. Document shape, delegated to `@ezclassify/validator`, the schema-only
 *    validator published from the `contracts` repository. It compiles the
 *    published JSON Schemas and reports where a document violates them.
 * 2. Folder bookkeeping: filenames match the `id` and `version` inside each
 *    document, and the manifest lists exactly the definitions on disk.
 * 3. Behavior test suites: every file in `scheme-folder/test-suites/` holds
 *    one `testSuite:` document that satisfies the published suite schema from
 *    `@ezclassify/schemas`, is named `<id>@<version>.yaml` for the suite it
 *    holds, and composes only definitions this folder holds. Every scheme
 *    version on disk is the scheme of at least one suite.
 *
 * Check 3 stops at the suite's shape and its references. Whether each case's
 * input produces the outcome it asserts is what `ezclassify scheme test`
 * answers, and the runner revalidates every suite before it runs a case.
 *
 * Exits non-zero on any error (CI-able).
 * @module
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
    FOLDER,
    MANIFEST_FILENAME,
    REPO_ROOT,
    TYPE_DIRS,
    FILENAME_PATTERN,
    listTypeDirFiles,
    validateDefinitionFile,
} from './lib/scheme-folder.mjs';
import {
    TEST_SUITES_DIRNAME,
    compositionRefs,
    effectiveComposition,
    readTestSuites,
} from './lib/test-suites.mjs';
import { parseDocument } from '@ezclassify/validator';

const manifestPath = path.join(FOLDER, MANIFEST_FILENAME);

const errors = [];

/**
 * Record one failure.
 *
 * @param {string} code Short machine-readable reason.
 * @param {string} message Human-readable detail.
 * @param {string} [file] Absolute path the failure is about.
 */
function fail(code, message, file) {
    errors.push({ code, message, file });
}

/** Every `<id>@<version>` present on disk, by kind. Filled in by the folder pass. */
const onDisk = Object.fromEntries(TYPE_DIRS.map(({ kind }) => [kind, new Set()]));

// 1 + 2: document shape and folder bookkeeping.

if (!fs.existsSync(manifestPath)) {
    fail('manifest_missing', `scheme folder manifest not found: ${manifestPath}`);
} else {
    let manifest;
    try {
        manifest = parseDocument(manifestPath);
    } catch (error) {
        fail('manifest_unparseable', `could not parse manifest: ${error.message}`, manifestPath);
    }

    for (const { kind, dir, manifestKey } of TYPE_DIRS) {
        // Every entry the manifest claims, as `<id>@<version>`.
        const declared = new Set();
        for (const entry of manifest?.[manifestKey] ?? []) {
            for (const version of entry.versions ?? []) {
                declared.add(`${entry.id}@${version}`);
            }
        }

        for (const file of listTypeDirFiles(FOLDER, dir)) {
            const fileName = path.basename(file);

            // Shape, via the public validator.
            const result = validateDefinitionFile(file, kind);
            for (const error of result.errors) {
                fail('schema_invalid', `${error.path || '/'}: ${error.message}`, file);
            }
            if (!result.ok) continue;

            // The filename must state the same id and version the document does.
            const document = parseDocument(file)[kind];
            const parsedName = FILENAME_PATTERN.exec(fileName);
            if (!parsedName) {
                fail('filename_format', `filename "${fileName}" is not <id>@<version>.yaml`, file);
                continue;
            }
            const [, nameId, nameVersion] = parsedName;
            if (nameId !== document.id || nameVersion !== document.version) {
                fail(
                    'filename_mismatch',
                    `filename "${fileName}" does not match in-file id "${document.id}" / version "${document.version}"`,
                    file,
                );
                continue;
            }
            onDisk[kind].add(`${document.id}@${document.version}`);
        }

        // Only cross-check against a manifest that parsed. An unreadable one
        // declares nothing, so comparing disk to it would report every
        // definition as undeclared and bury the one error that matters.
        if (manifest === undefined) continue;

        for (const ref of onDisk[kind]) {
            if (!declared.has(ref)) {
                fail(
                    'manifest_missing_entry',
                    `${kind} "${ref}" is on disk but not in the manifest`,
                );
            }
        }
        for (const ref of declared) {
            if (!onDisk[kind].has(ref)) {
                fail('manifest_extra_entry', `${kind} "${ref}" is in the manifest but not on disk`);
            }
        }
    }
}

// 3: behavior test suites.

const entries = readTestSuites(FOLDER);
for (const { file, problems } of entries) {
    for (const { code, message } of problems) fail(code, message, file);
}
const suites = new Map(
    entries
        .filter((entry) => entry.suite)
        .map(({ suite, file }) => [`${suite.id}@${suite.version}`, { suite, file }]),
);
const bySuiteKey = new Map([...suites].map(([key, { suite }]) => [key, suite]));

/** Every scheme version some suite runs against. */
const covered = new Set();

for (const { suite, file } of suites.values()) {
    const caseIds = new Set();
    for (const { id } of suite.cases) {
        if (caseIds.has(id)) fail('case_id_duplicate', `case id "${id}" appears twice`, file);
        caseIds.add(id);
    }

    if (suite.extends) {
        const parent = `${suite.extends.id}@${suite.extends.version}`;
        if (!suites.has(parent)) {
            fail(
                'suite_parent_unresolved',
                `extends suite "${parent}", which ${TEST_SUITES_DIRNAME}/ does not hold`,
                file,
            );
            continue;
        }
    }
    const composition = effectiveComposition(suite, bySuiteKey);
    if (!composition) {
        fail('suite_parent_unresolved', 'its extends chain does not reach a composition', file);
        continue;
    }
    for (const { kind, ref, where } of compositionRefs(composition)) {
        if (!onDisk[kind]?.has(ref)) {
            fail(
                'suite_composition_unresolved',
                `${where} names ${kind} "${ref}", which this folder does not hold`,
                file,
            );
        }
    }
    covered.add(`${composition.scheme.id}@${composition.scheme.version}`);
}

// Every published scheme carries behavior coverage. A scheme with no suite is a
// scheme nobody has stated the expected behavior of.
for (const ref of onDisk.scheme) {
    if (!covered.has(ref)) {
        fail(
            'scheme_uncovered',
            `scheme "${ref}" has no test suite in ${TEST_SUITES_DIRNAME}/ whose composition names it`,
        );
    }
}

const relative = path.relative(REPO_ROOT, FOLDER);

if (errors.length === 0) {
    console.log(
        `[validate] ${relative} is valid (document shape, folder bookkeeping, ${suites.size} test suites).`,
    );
    process.exit(0);
}

console.error(`[validate] ${relative} is invalid:`);
for (const err of errors) {
    const where = err.file ? ` (${path.relative(REPO_ROOT, err.file)})` : '';
    console.error(`  [${err.code}] ${err.message}${where}`);
}
process.exit(1);
