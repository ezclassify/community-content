#!/usr/bin/env node
/**
 * Turn the committed CLI pin into a runnable `ezclassify`, or fail.
 *
 * A configured pin promises that the behavioral suites run. Missing or
 * unusable executables must fail resolution rather than leave the caller with
 * an empty CLI path and a passing skip.
 *
 * There are exactly two outcomes here:
 *
 * - The pin declares a source. It resolves to a CLI that answers `--version`,
 *   or this exits non-zero and names what went wrong.
 * - The pin declares no source. This says so and exits 0. The behavioral lane
 *   then needs a CLI supplied some other way, and fails without one.
 *
 * Usage:
 *   node scripts/resolve-cli.mjs [--pin <path>] [--work-dir <path>] [--github]
 *
 * `--github` writes `EZCLASSIFY_CLI` to `$GITHUB_ENV` and `source=` to
 * `$GITHUB_OUTPUT`, so the workflow can run the suites against the resolved
 * CLI and name the source in its summary.
 * @module
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { CliPinError, PIN_PATH, readPin, resolvePinnedCli } from './lib/cli-pin.mjs';
import { REPO_ROOT } from './lib/scheme-folder.mjs';

const args = process.argv.slice(2);

/** @param {string} flag @param {string} [fallback] */
function option(flag, fallback) {
    const index = args.indexOf(flag);
    return index === -1 ? fallback : args[index + 1];
}

const pinPath = path.resolve(option('--pin', PIN_PATH));
const workDir = path.resolve(option('--work-dir', path.join(REPO_ROOT, '.cli')));
const github = args.includes('--github');

/** @param {string} file @param {string} line */
function appendTo(file, line) {
    if (file) fs.appendFileSync(file, `${line}\n`);
}

try {
    const pin = readPin(pinPath);
    const result = await resolvePinnedCli(pin, { workDir });

    if (result.status === 'unconfigured') {
        console.log(
            `[cli-pin] ${path.basename(pinPath)} declares no verified CLI download; the behavioral lane needs a CLI supplied another way.`,
        );
        if (github) {
            appendTo(process.env['GITHUB_OUTPUT'] ?? '', 'source=none');
        }
        process.exit(0);
    }

    console.log(`[cli-pin] resolved the pinned CLI from the ${result.source}: ${result.cli}`);
    if (github) {
        appendTo(process.env['GITHUB_ENV'] ?? '', `EZCLASSIFY_CLI=${result.cli}`);
        appendTo(process.env['GITHUB_OUTPUT'] ?? '', `source=${result.source}`);
    } else {
        console.log(result.cli);
    }
} catch (error) {
    if (error instanceof CliPinError) {
        console.error(`[cli-pin] ${error.message}`);
        console.error(
            '[cli-pin] A configured pin is a promise that the behavioral suites run. Failing the job instead of skipping it.',
        );
        process.exit(1);
    }
    throw error;
}
