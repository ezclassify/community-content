#!/usr/bin/env node
/**
 * Guard `ezclassify-cli.json`.
 *
 * The behavioral lane downloads and runs a binary. The only thing standing
 * between "CI runs the suites" and "CI runs whatever a pull request pointed it
 * at" is that this file names a verified artifact and that a pull request
 * cannot quietly change it. This script enforces the first half; branch
 * protection and code owners enforce the second.
 *
 * Rules (see `scripts/lib/cli-pin.mjs`, which both this check and the resolver
 * read so they cannot disagree):
 *
 * - `minimumVersion` and `testedVersion` are present and look like versions,
 *   and the tested version is not below the minimum.
 * - A declared archive has both an https URL and a sha256.
 * - A declared image has both a ref and a sha256 digest.
 * - A source declared without its checksum is refused. An unverified download
 *   is worse than no download.
 *
 * Exits non-zero on any problem (CI-able). `--pin <path>` points it at another
 * file, which is how its rules are tested.
 * @module
 */
import * as path from 'node:path';

import { PIN_FILENAME, PIN_PATH, declaredSources, readPin, validatePin } from './lib/cli-pin.mjs';

const args = process.argv.slice(2);
const flag = args.indexOf('--pin');
const pinPath = flag === -1 ? PIN_PATH : path.resolve(args[flag + 1]);

let pin;
try {
    pin = readPin(pinPath);
} catch (error) {
    console.error(`[cli-pin] ${error.message}`);
    process.exit(1);
}

const problems = validatePin(pin);
if (problems.length > 0) {
    console.error(`[cli-pin] ${PIN_FILENAME} is not usable:`);
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
}

const sources = declaredSources(pin);
console.log(
    sources.length > 0
        ? `[cli-pin] CLI ${pin.testedVersion} pinned by ${sources.join(' + ')}; the behavioral lane must run.`
        : `[cli-pin] CLI ${pin.testedVersion} declared, no public download yet; the behavioral lane requires an explicitly supplied CLI.`,
);
