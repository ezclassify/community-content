/**
 * The behavior lane's client for an EzClassify authoring runtime.
 *
 * Each suite in the folder names the scheme, guides, access policy and
 * crosswalks it runs against, with their layers. This module reads those
 * documents from the folder, sends them to the runtime's draft door
 * (`PUT /v1/sandbox/ctx`) and runs the suite against the draft it answers with
 * (`POST /v1/authoring/suites/run`). It evaluates nothing itself: every verdict
 * is the runtime's.
 *
 * The runtime is a licensed dev-root build that `stage` in the engine
 * repository writes an installation for. A caller either names a running one
 * or hands over the stage plan and lets {@link launchStaged} start the
 * planned authoring command for the length of the run.
 * @module
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';

import { TYPE_DIRS, listTypeDirFiles } from './scheme-folder.mjs';
import { readTestSuites } from './test-suites.mjs';

/** The session every draft of one run is held under. */
export const SESSION = 'community-content-behavior';

/** How long a staged runtime has to print its listening line. */
const START_TIMEOUT_MS = 60_000;

/** Raised when the lane cannot reach a verdict, as opposed to a suite failing. */
export class LaneError extends Error {}

/**
 * Read every document of a kind as `{id, version, text, document}` keyed by
 * `id@version`. The text is sent to the runtime untouched; the parsed form is
 * read only for the identity and the references a crosswalk makes.
 *
 * @param {string} folder Scheme-folder root.
 * @param {(text: string) => unknown} parse YAML reader.
 * @returns {Record<string, Map<string, {text: string, document: Record<string, any>}>>}
 */
export function readDocuments(folder, parse) {
    const documents = {};
    for (const { kind, dir } of TYPE_DIRS) {
        const byRef = new Map();
        for (const file of listTypeDirFiles(folder, dir)) {
            const text = fs.readFileSync(file, 'utf-8');
            const document = parse(text);
            const body = document?.[kind];
            if (body && typeof body.id === 'string' && typeof body.version === 'string')
                byRef.set(`${body.id}@${body.version}`, { text, document: body });
        }
        documents[kind] = byRef;
    }
    return documents;
}

/**
 * The draft body a suite's composition asks for, as the draft door reads it.
 *
 * A crosswalk's other scheme rides along as a keyed scheme, and the suite's own
 * scheme stays primary. Layers go on each component in the order the suite
 * lists them.
 *
 * @param {Record<string, any>} composition The suite's `composition`.
 * @param {ReturnType<typeof readDocuments>} documents The folder's documents.
 * @returns {Record<string, unknown>}
 * @throws {LaneError} When the composition names a document the folder lacks.
 */
export function draftBody(composition, documents) {
    const find = (kind, ref) => {
        const found = documents[kind].get(`${ref.id}@${ref.version}`);
        if (!found) throw new LaneError(`no ${kind} ${ref.id}@${ref.version} in the folder`);
        return found;
    };
    const texts = (kind, refs) => (refs ?? []).map((layer) => find(kind, layer).text);
    const stack = (kind, ref) => ({ text: find(kind, ref).text, layers: texts(kind, ref.layers) });
    const withLayers = (key, base, layers) =>
        layers.length ? { [key]: base, layers } : { [key]: base };

    const body = {};
    const primary = stack('scheme', composition.scheme);
    const crosswalks = (composition.crosswalks ?? []).map((ref) => ({
        ref,
        ...stack('crosswalk', ref),
    }));
    if (crosswalks.length === 0) {
        body.scheme = primary.text;
        if (primary.layers.length) body.layers = primary.layers;
    } else {
        const schemes = new Map([[composition.scheme.id, composition.scheme]]);
        for (const { ref } of crosswalks) {
            const crosswalk = find('crosswalk', ref).document;
            for (const end of [crosswalk.source_scheme, crosswalk.target_scheme])
                if (end && !schemes.has(end.id)) schemes.set(end.id, end);
        }
        body.schemes = [...schemes.values()].map((ref) => ({
            key: ref.id,
            ...withLayers('scheme', stack('scheme', ref).text, stack('scheme', ref).layers),
        }));
        body.primaryScheme = composition.scheme.id;
        body.crosswalkComponents = crosswalks.map(({ text, layers }) =>
            withLayers('crosswalk', text, layers),
        );
    }
    if (composition.guides?.length)
        body.guideComponents = composition.guides.map((ref) => {
            const { text, layers } = stack('guide', ref);
            return withLayers('guide', text, layers);
        });
    if (composition.access) {
        const { text, layers } = stack('access', composition.access);
        body.accessComponent = withLayers('access', text, layers);
    }
    return body;
}

/**
 * Send one request to the runtime and return the status with its JSON body.
 *
 * @param {typeof fetch} send The fetch to use.
 * @param {string} url Full URL.
 * @param {{method: string, body?: unknown}} request
 * @returns {Promise<{status: number, body: any}>}
 */
async function call(send, url, { method, body }) {
    let response;
    try {
        response = await send(url, {
            method,
            headers: { 'content-type': 'application/json', 'x-ezclassify-session': SESSION },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: AbortSignal.timeout(120_000),
        });
    } catch (error) {
        throw new LaneError(
            `the authoring runtime did not answer ${method} ${url}: ${error.message}`,
        );
    }
    const text = await response.text();
    try {
        return { status: response.status, body: text ? JSON.parse(text) : null };
    } catch {
        return { status: response.status, body: { message: text.slice(0, 500) } };
    }
}

/** What the runtime said was wrong, in one line. */
function reason(answer) {
    const body = answer.body ?? {};
    const found = (body.diagnostics ?? []).map((d) => d.message ?? JSON.stringify(d));
    return [body.message ?? body.detail ?? body.error ?? `HTTP ${answer.status}`, ...found].join(
        '; ',
    );
}

/**
 * Run every suite in the folder on the runtime.
 *
 * A suite that cannot be read, composed or run is a failed run with the
 * runtime's reason, never a skipped one.
 *
 * @param {object} options
 * @param {string} options.folder Scheme-folder root.
 * @param {string} options.baseUrl The runtime's origin.
 * @param {(text: string) => unknown} options.parse YAML reader.
 * @param {typeof fetch} [options.send] Fetch override for tests.
 * @returns {Promise<{engineVersion: string, runs: Array<Record<string, any>>}>}
 */
export async function runFolderSuites({ folder, baseUrl, parse, send = fetch }) {
    const base = baseUrl.replace(/\/+$/, '');
    const health = await call(send, `${base}/v1/health`, { method: 'GET' });
    if (health.status !== 200 || typeof health.body?.engineVersion !== 'string')
        throw new LaneError(`the authoring runtime's health answer is unusable: ${reason(health)}`);
    const documents = readDocuments(folder, parse);
    const runs = [];
    for (const entry of readTestSuites(folder)) {
        const name = entry.fileName;
        if (!entry.suite) {
            runs.push({
                suite: name,
                refused: entry.problems.map((p) => `${p.code}: ${p.message}`).join('; '),
            });
            continue;
        }
        try {
            const draft = await call(send, `${base}/v1/sandbox/ctx`, {
                method: 'PUT',
                body: draftBody(entry.suite.composition, documents),
            });
            if (draft.status !== 200 || typeof draft.body?.contextId !== 'string') {
                runs.push({ suite: name, refused: `the draft was refused: ${reason(draft)}` });
                continue;
            }
            const run = await call(send, `${base}/v1/authoring/suites/run`, {
                method: 'POST',
                body: {
                    contextId: draft.body.contextId,
                    suite: fs.readFileSync(entry.file, 'utf-8'),
                },
            });
            runs.push(
                run.status === 200
                    ? { suite: name, report: run.body }
                    : { suite: name, refused: `the run was refused: ${reason(run)}` },
            );
        } catch (error) {
            if (!(error instanceof LaneError) || error.message.startsWith('the authoring runtime'))
                throw error;
            runs.push({ suite: name, refused: error.message });
        }
    }
    return { engineVersion: health.body.engineVersion, runs };
}

/**
 * Whether a run is a pass: it ran, and every selected case passed.
 *
 * @param {Record<string, any>} run One entry of {@link runFolderSuites}.
 * @returns {boolean}
 */
export function passed(run) {
    const totals = run.report?.totals;
    return (
        totals !== undefined &&
        totals.passed > 0 &&
        totals.failed === 0 &&
        totals.errored === 0 &&
        totals.notEvaluated === 0
    );
}

/** One line per run for the operator's terminal. */
export function summarize(run) {
    if (run.refused !== undefined) return `FAIL ${run.suite}: ${run.refused}`;
    const t = run.report.totals;
    const verdict = passed(run) ? 'ok  ' : 'FAIL';
    return `${verdict} ${run.suite}: ${t.passed} passed, ${t.failed} failed, ${t.errored} errored, ${t.notEvaluated} not evaluated`;
}

/**
 * Start the authoring runtime a stage plan describes and wait for it to listen.
 *
 * @param {string} planFile Path to the `stage.json` that `stage` printed.
 * @returns {Promise<{baseUrl: string, stop: () => Promise<void>}>}
 * @throws {LaneError} When the plan is unusable or the runtime does not start.
 */
export async function launchStaged(planFile) {
    let plan;
    try {
        plan = JSON.parse(fs.readFileSync(planFile, 'utf-8'));
    } catch (error) {
        throw new LaneError(`the stage plan ${planFile} cannot be read: ${error.message}`);
    }
    const planned = plan?.authoring;
    if (!Array.isArray(planned?.command) || planned.command.length === 0 || !planned.env)
        throw new LaneError(`the stage plan ${planFile} has no authoring command`);
    const [command, ...args] = planned.command;
    const child = spawn(command, args, {
        env: { PATH: process.env['PATH'] ?? '', ...planned.env },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    const lines = [];
    const address = await new Promise((resolve, reject) => {
        const timer = setTimeout(
            () =>
                reject(
                    new LaneError(
                        `the staged authoring runtime did not start in time: ${lines.join(' | ')}`,
                    ),
                ),
            START_TIMEOUT_MS,
        );
        const read = (chunk) => {
            for (const line of chunk.toString().split('\n')) {
                lines.push(line);
                const match = /listening on (\S+)/.exec(line);
                if (match) {
                    clearTimeout(timer);
                    resolve(match[1]);
                }
            }
        };
        child.stdout.on('data', read);
        child.stderr.on('data', read);
        child.on('error', (error) => {
            clearTimeout(timer);
            reject(new LaneError(`the staged authoring runtime cannot start: ${error.message}`));
        });
        child.on('exit', (code) => {
            clearTimeout(timer);
            reject(
                new LaneError(
                    `the staged authoring runtime exited with ${code}: ${lines.join(' | ')}`,
                ),
            );
        });
    }).catch((error) => {
        child.kill('SIGKILL');
        throw error;
    });
    return {
        baseUrl: `http://${address}`,
        stop: () =>
            new Promise((resolve) => {
                child.removeAllListeners('exit');
                child.once('exit', () => resolve());
                child.kill('SIGTERM');
            }),
    };
}
