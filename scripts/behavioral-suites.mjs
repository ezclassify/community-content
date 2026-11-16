#!/usr/bin/env node
/**
 * Run the folder's behavior suites on an EzClassify authoring runtime.
 *
 * This explicit lane needs a licensed dev-root authoring runtime, which `stage`
 * in the engine repository writes an installation for. Name a running one with
 * `EZCLASSIFY_AUTHORING_URL`, or hand over the `stage.json` plan with
 * `EZCLASSIFY_STAGE_PLAN` and this script starts the planned runtime for the
 * length of the run. A missing or unreachable runtime fails; schema validation
 * remains the independent public lane.
 * @module
 */
import * as fs from 'node:fs';
import yaml from 'js-yaml';

import {
    LaneError,
    launchStaged,
    passed,
    runFolderSuites,
    summarize,
} from './lib/behavior-run.mjs';
import { FOLDER } from './lib/scheme-folder.mjs';

const args = process.argv.slice(2);
const reportFlagIndex = args.indexOf('--report');
const reportPath = reportFlagIndex === -1 ? undefined : args[reportFlagIndex + 1];
// A `--report` with nothing after it, or another flag after it, would otherwise
// be taken as a filename and write the report somewhere nobody asked for.
if (reportFlagIndex !== -1 && (reportPath === undefined || reportPath.startsWith('--'))) {
    console.error('[behavior] --report needs a file path, for example --report ./results.json');
    process.exit(1);
}

// Record failure before any prerequisite check, so CI cannot label an
// unavailable runtime as a skipped behavioral run.
if (process.env['GITHUB_OUTPUT']) {
    fs.appendFileSync(process.env['GITHUB_OUTPUT'], 'status=failed\n');
}

const url = process.env['EZCLASSIFY_AUTHORING_URL'];
const plan = process.env['EZCLASSIFY_STAGE_PLAN'];
if (Boolean(url) === Boolean(plan)) {
    console.error(
        '[behavior] required lane cannot run: set exactly one of EZCLASSIFY_AUTHORING_URL ' +
            '(a running dev-root authoring runtime) or EZCLASSIFY_STAGE_PLAN (the stage.json from `stage`).',
    );
    process.exit(1);
}

let staged;
let result;
try {
    staged = plan ? await launchStaged(plan) : undefined;
    result = await runFolderSuites({
        folder: FOLDER,
        baseUrl: staged?.baseUrl ?? url,
        parse: (text) => yaml.load(text),
    });
} catch (error) {
    if (!(error instanceof LaneError)) throw error;
    console.error(`[behavior] ${error.message}`);
    process.exit(1);
} finally {
    await staged?.stop();
}

for (const run of result.runs) console.log(`[behavior] ${summarize(run)}`);
if (reportPath) fs.writeFileSync(reportPath, `${JSON.stringify(result, null, 2)}\n`);

const ok = result.runs.length > 0 && result.runs.every(passed);
console.log(
    `[behavior] engine ${result.engineVersion}: ${result.runs.filter(passed).length} of ${result.runs.length} suites passed`,
);
if (process.env['GITHUB_OUTPUT']) {
    fs.appendFileSync(process.env['GITHUB_OUTPUT'], `status=${ok ? 'passed' : 'failed'}\n`);
}
process.exit(ok ? 0 : 1);
