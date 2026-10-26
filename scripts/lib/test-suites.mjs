/**
 * Behavior test suites in the scheme folder, read from public packages only.
 *
 * A suite lives in `scheme-folder/test-suites/<id>@<version>.yaml` and holds one
 * document under a single `testSuite:` key. Its shape is the published
 * `TestSuite` contract, checked here with the JSON Schema from
 * `@ezclassify/schemas`. Nothing in this module runs a case: evaluating a suite
 * needs the engine, and that is the EzClassify CLI's job (`ezclassify scheme
 * test`).
 *
 * `validate-folder.mjs` and `bundle-test-suites.mjs` both read suites through
 * this module, so the folder check and the published package cannot disagree
 * about what a suite is.
 * @module
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import yaml from 'js-yaml';
import Ajv from 'ajv';
import { testSuiteSchema } from '@ezclassify/schemas/test-suite-schema';

import { FILENAME_PATTERN, isPlainObject } from './scheme-folder.mjs';

/** The folder directory that holds the behavior test suites. */
export const TEST_SUITES_DIRNAME = 'test-suites';

const validateSuite = new Ajv({ strict: false, allErrors: true }).compile(testSuiteSchema);

/**
 * @typedef {{code: string, message: string}} SuiteProblem
 * @typedef {{file: string, fileName: string, suite?: Record<string, any>, problems: SuiteProblem[]}} SuiteEntry
 */

/**
 * Read every entry in the folder's `test-suites/` directory, sorted by name.
 *
 * Each entry carries the problems found in it. An entry with no problems holds
 * a schema-valid suite whose file name matches its `id` and `version`. Anything
 * other than a plain `.yaml` file is reported rather than skipped, so stray
 * content cannot sit in the directory unnoticed.
 *
 * @param {string} folder Scheme-folder root.
 * @returns {SuiteEntry[]}
 */
export function readTestSuites(folder) {
    const dir = path.join(folder, TEST_SUITES_DIRNAME);
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((entry) => !entry.name.startsWith('.'))
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
        .map((entry) => readEntry(path.join(dir, entry.name), entry));
}

/**
 * Read and check one directory entry.
 *
 * @param {string} file Absolute path.
 * @param {fs.Dirent} entry Its directory entry.
 * @returns {SuiteEntry}
 */
function readEntry(file, entry) {
    const fileName = path.basename(file);
    const result = { file, fileName, problems: [] };
    const problem = (code, message) => {
        result.problems.push({ code, message });
        return result;
    };

    // A symlink can point anywhere, including outside the repository. The
    // folder holds plain files, so refuse rather than follow.
    if (entry.isSymbolicLink()) return problem('suite_symlink', 'symlinks are not allowed here');
    if (!entry.isFile() || !/\.yaml$/.test(fileName))
        return problem('suite_unexpected_file', 'only <id>@<version>.yaml suite files belong here');

    let parsed;
    try {
        parsed = yaml.load(fs.readFileSync(file, 'utf-8'));
    } catch (error) {
        return problem('suite_unparseable', `could not parse YAML: ${error.message}`);
    }
    if (!isPlainObject(parsed) || Object.keys(parsed).join() !== 'testSuite')
        return problem(
            'suite_shape',
            'a suite file holds one document under a single `testSuite:` key',
        );

    const suite = parsed.testSuite;
    if (!validateSuite(suite)) {
        for (const error of validateSuite.errors ?? []) {
            const detail = error.params?.allowedValue ?? error.params?.additionalProperty;
            problem(
                'suite_schema_invalid',
                `${error.instancePath || '/'}: ${error.message}${detail === undefined ? '' : ` (${JSON.stringify(detail)})`}`,
            );
        }
        return result;
    }

    const named = FILENAME_PATTERN.exec(fileName);
    if (!named || named[1] !== suite.id || named[2] !== suite.version)
        return problem(
            'suite_filename_mismatch',
            `file name must be ${suite.id}@${suite.version}.yaml for the suite it holds`,
        );

    result.suite = suite;
    return result;
}

/**
 * The composition a suite runs against: its own, or the nearest ancestor's when
 * it extends a parent and names none.
 *
 * @param {Record<string, any>} suite A schema-valid suite.
 * @param {Map<string, Record<string, any>>} suites Every valid suite in the folder, by `id@version`.
 * @returns {Record<string, any> | undefined} Undefined when a parent is missing or the chain loops.
 */
export function effectiveComposition(suite, suites) {
    const seen = new Set();
    let current = suite;
    while (current) {
        if (current.composition) return current.composition;
        if (!current.extends) return undefined;
        const key = `${current.extends.id}@${current.extends.version}`;
        if (seen.has(key)) return undefined;
        seen.add(key);
        current = suites.get(key);
    }
    return undefined;
}

/**
 * Every definition a composition names, as `{kind, ref, where}`.
 *
 * Scheme layers are schemes, guide layers are guides, and access layers are
 * access policies. Crosswalks are listed under their own kind, which this
 * folder does not hold.
 *
 * @param {Record<string, any>} composition
 * @returns {Array<{kind: string, ref: string, where: string}>}
 */
export function compositionRefs(composition) {
    const refs = [];
    const add = (kind, value, where) => {
        refs.push({ kind, ref: `${value.id}@${value.version}`, where });
        for (const [index, layer] of (value.layers ?? []).entries())
            refs.push({
                kind,
                ref: `${layer.id}@${layer.version}`,
                where: `${where}.layers[${index}]`,
            });
    };
    add('scheme', composition.scheme, 'composition.scheme');
    for (const [index, guide] of (composition.guides ?? []).entries())
        add('guide', guide, `composition.guides[${index}]`);
    if (composition.access) add('access', composition.access, 'composition.access');
    for (const [index, crosswalk] of (composition.crosswalks ?? []).entries())
        add('crosswalk', crosswalk, `composition.crosswalks[${index}]`);
    return refs;
}

/**
 * The policy a suite qualifies, for the published suite index: the access
 * policy when the composition has one, else its first guide, else its scheme.
 *
 * @param {Record<string, any>} composition
 * @returns {{kind: 'access' | 'guide' | 'scheme', id: string, version: string}}
 */
export function testPolicyOf(composition) {
    const ref = ({ id, version }) => ({ id, version });
    if (composition.access) return { kind: 'access', ...ref(composition.access) };
    if (composition.guides?.length) return { kind: 'guide', ...ref(composition.guides[0]) };
    return { kind: 'scheme', ...ref(composition.scheme) };
}
