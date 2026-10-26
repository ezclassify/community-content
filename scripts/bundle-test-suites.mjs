#!/usr/bin/env node
/**
 * Compile the folder's behavior test suites into the published package.
 *
 * Reads `scheme-folder/test-suites/*.yaml`, refuses to write anything if one of
 * them is invalid, and writes:
 *
 *   dist/test-suites/<id>@<version>.json   { testSuite: {...} }
 *   dist/test-suites/index.json            { testSuites: [{id, version, testPolicy, filename}] }
 *
 * `testPolicy` names the policy each suite qualifies (see `testPolicyOf`).
 * The output directory is rebuilt from scratch on every run because it ships
 * through a wildcard export: a stale file left behind would publish.
 * @module
 */
import fs from 'node:fs';
import path from 'node:path';
import { FOLDER, REPO_ROOT } from './lib/scheme-folder.mjs';
import { effectiveComposition, readTestSuites, testPolicyOf } from './lib/test-suites.mjs';

const entries = readTestSuites(FOLDER);
const invalid = entries.filter((entry) => entry.problems.length > 0);
if (invalid.length > 0) {
    console.error('[test-suites] refusing to build from invalid suites:');
    for (const { fileName, problems } of invalid)
        for (const { code, message } of problems)
            console.error(`  [${code}] ${message} (${fileName})`);
    console.error('[test-suites] npm run validate reports the full folder.');
    process.exit(1);
}

const suites = new Map(entries.map(({ suite }) => [`${suite.id}@${suite.version}`, suite]));
const index = [];
for (const { suite, fileName } of entries) {
    const composition = effectiveComposition(suite, suites);
    if (!composition) {
        console.error(`[test-suites] ${fileName} extends a suite this folder does not hold`);
        process.exit(1);
    }
    index.push({
        id: suite.id,
        version: suite.version,
        testPolicy: testPolicyOf(composition),
        filename: `${suite.id}@${suite.version}.json`,
    });
}

const dist = path.join(REPO_ROOT, 'dist', 'test-suites');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
for (const [i, { suite }] of entries.entries())
    fs.writeFileSync(
        path.join(dist, index[i].filename),
        `${JSON.stringify({ testSuite: suite }, null, 2)}\n`,
    );
fs.writeFileSync(
    path.join(dist, 'index.json'),
    `${JSON.stringify({ testSuites: index }, null, 2)}\n`,
);
console.log(
    `[test-suites] bundled ${entries.length} suites with ${entries.reduce((sum, { suite }) => sum + suite.cases.length, 0)} cases`,
);
