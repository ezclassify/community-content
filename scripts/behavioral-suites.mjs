#!/usr/bin/env node
/**
 * Run authored behavior suites with a caller-provided or installed CLI.
 *
 * This explicit integration lane requires a licensed runtime executable. A
 * missing CLI fails; schema validation remains the independent public lane.
 * @module
 */
import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { CliPinError, declaredSources, readPin } from './lib/cli-pin.mjs';
import { FOLDER, REPO_ROOT } from './lib/scheme-folder.mjs';

const args = process.argv.slice(2);
const reportFlagIndex = args.indexOf('--report');
const reportPath = reportFlagIndex === -1 ? undefined : args[reportFlagIndex + 1];
// `--report` with nothing after it, or with the next flag after it, would
// otherwise be taken as a filename and write the report somewhere nobody asked
// for. The lane's whole point is an honest outcome, so a malformed invocation
// stops here rather than producing a plausible-looking run.
if (reportFlagIndex !== -1 && (reportPath === undefined || reportPath.startsWith('--'))) {
    console.error('[behavior] --report needs a file path, for example --report ./results.json');
    process.exit(1);
}

// The pin decides what this lane may do, so an unreadable one is a
// configuration failure with a message, not a stack trace.
let pin;
try {
    pin = readPin();
} catch (error) {
    if (!(error instanceof CliPinError)) throw error;
    console.error(`[behavior] ${error.message}`);
    process.exit(1);
}

/**
 * Locate a runnable CLI.
 *
 * @returns {string | undefined} The executable, or undefined when there is none.
 */
function findCli() {
    const explicit = process.env['EZCLASSIFY_CLI'];
    if (explicit) {
        if (!fs.existsSync(explicit)) {
            console.error(`[behavior] EZCLASSIFY_CLI points at ${explicit}, which does not exist.`);
            process.exit(1);
        }
        return explicit;
    }
    const probe = spawnSync('ezclassify', ['--version'], { encoding: 'utf-8' });
    return probe.status === 0 ? 'ezclassify' : undefined;
}

// Record failure before prerequisite checks too, so CI cannot label a failed
// or unavailable executable as a skipped behavioral run.
if (process.env['GITHUB_OUTPUT']) {
    fs.appendFileSync(process.env['GITHUB_OUTPUT'], 'status=failed\n');
}

const cli = findCli();
if (!cli) {
    const reason =
        declaredSources(pin).length > 0
            ? 'no CLI on PATH; resolve the pinned artifact with scripts/resolve-cli.mjs'
            : 'no EzClassify CLI available; ezclassify-cli.json declares no verified public download';
    console.error(`[behavior] required lane cannot run: ${reason}`);
    process.exit(1);
}

// A packaged CLI is an executable; a CLI built from a checkout is a .js entry
// point with no exec bit. Run the latter through the current node so pointing
// EZCLASSIFY_CLI at a local build works without a wrapper script.
const isScript = /\.[cm]?js$/.test(cli);
const command = isScript ? process.execPath : cli;
const cliArgs = [...(isScript ? [cli] : []), 'scheme', 'test', path.relative(REPO_ROOT, FOLDER)];
if (reportPath) cliArgs.push('--report', reportPath);

console.log(`[behavior] running: ${command} ${cliArgs.join(' ')}`);
try {
    execFileSync(command, cliArgs, { cwd: REPO_ROOT, stdio: 'inherit' });
} catch (error) {
    if (process.env['GITHUB_OUTPUT']) {
        fs.appendFileSync(process.env['GITHUB_OUTPUT'], 'status=failed\n');
    }
    process.exit(error.status ?? 1);
}
if (process.env['GITHUB_OUTPUT']) {
    fs.appendFileSync(process.env['GITHUB_OUTPUT'], 'status=passed\n');
}
