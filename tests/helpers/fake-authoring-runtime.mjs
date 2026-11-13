/**
 * A stand-in for the authoring runtime's three routes, for the lane's own specs.
 *
 * It answers like the real runtime: a health probe, the draft door and the
 * suite run. Every request is appended to the file `FAKE_LOG` names. It prints
 * the `listening on <address>` line the staged runtime prints. A suite named by
 * `FAKE_FAIL` reports one failed case; `FAKE_REFUSE_DRAFTS=1` answers every
 * draft with the 422 an uncomposable draft gets.
 */
import { appendFileSync } from 'node:fs';
import { createServer } from 'node:http';

const server = createServer((request, response) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        const body = text ? JSON.parse(text) : null;
        appendFileSync(
            process.env.FAKE_LOG,
            `${JSON.stringify({ method: request.method, url: request.url, session: request.headers['x-ezclassify-session'], body })}\n`,
        );
        const send = (status, value) => {
            response.writeHead(status, { 'content-type': 'application/json' });
            response.end(JSON.stringify(value));
        };
        if (request.url === '/v1/health')
            return send(200, { status: 'ok', engineVersion: '9.9.9-fake' });
        if (request.url === '/v1/sandbox/ctx') {
            if (process.env.FAKE_REFUSE_DRAFTS) return send(422, { message: 'does not compose' });
            return send(200, { contextId: `sbx-${text.length}` });
        }
        if (request.url === '/v1/authoring/suites/run') {
            const failed =
                process.env.FAKE_FAIL && body.suite.includes(`id: ${process.env.FAKE_FAIL}\n`);
            return send(200, {
                totals: { passed: 2, failed: failed ? 1 : 0, errored: 0, notEvaluated: 0 },
            });
        }
        return send(404, { error: 'not_found' });
    });
});
server.listen(0, '127.0.0.1', () => {
    console.log(`listening on 127.0.0.1:${server.address().port}`);
});
process.on('SIGTERM', () => server.close(() => process.exit(0)));
