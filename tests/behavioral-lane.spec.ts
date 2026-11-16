/**
 * The behavior lane: `scripts/behavioral-suites.mjs` sends the folder's
 * suites and the definitions they compose to an authoring runtime and reports
 * the runtime's verdicts. A stand-in runtime plays the three routes, so these
 * cases prove what the lane sends and that each way it can go wrong exits red.
 * The real verdicts come from a licensed dev-root runtime (`npm run test:behavior`).
 */
import { spawn } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

const repoRoot = path.resolve(__dirname, '..')
const fake = path.join(repoRoot, 'tests', 'helpers', 'fake-authoring-runtime.mjs')

const temps: string[] = []
afterEach(() => {
  while (temps.length > 0) fs.rmSync(temps.pop() as string, { recursive: true, force: true })
})

interface Request {
  method: string
  url: string
  session: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the stand-in logs whatever the lane sent
  body: Record<string, any>
}

/** Run the lane with `env`; resolves with the exit code, output and the fake's request log. */
function lane(env: Record<string, string>, args: string[] = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'behavior-lane-'))
  temps.push(dir)
  const log = path.join(dir, 'requests.jsonl')
  fs.writeFileSync(log, '')
  return new Promise<{ code: number; out: string; err: string; requests: Request[]; dir: string }>(
    (resolve) => {
      const child = spawn('node', ['scripts/behavioral-suites.mjs', ...args], {
        cwd: repoRoot,
        env: { PATH: process.env.PATH ?? '', FAKE_LOG: log, ...env },
      })
      let out = ''
      let err = ''
      child.stdout.on('data', (d) => (out += d))
      child.stderr.on('data', (d) => (err += d))
      child.on('close', (code) =>
        resolve({
          code: code ?? 1,
          out,
          err,
          dir,
          requests: fs
            .readFileSync(log, 'utf-8')
            .split('\n')
            .filter(Boolean)
            .map((line) => JSON.parse(line)),
        }),
      )
    },
  )
}

/** A stage plan whose authoring command is the stand-in runtime. */
function plan(dir: string, env: Record<string, string> = {}) {
  const file = path.join(dir, 'stage.json')
  fs.writeFileSync(
    file,
    JSON.stringify({
      authoring: { command: [process.execPath, fake], env: { FAKE_LOG: env.FAKE_LOG, ...env } },
    }),
  )
  return file
}

/** The lane against a stand-in started from a stage plan. */
async function staged(extra: Record<string, string> = {}, args: string[] = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'behavior-plan-'))
  temps.push(dir)
  const log = path.join(dir, 'requests.jsonl')
  fs.writeFileSync(log, '')
  const file = plan(dir, { FAKE_LOG: log, ...extra })
  const result = await lane({ EZCLASSIFY_STAGE_PLAN: file }, args)
  return {
    ...result,
    requests: fs
      .readFileSync(log, 'utf-8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line)) as Request[],
  }
}

describe('the behavioral lane', () => {
  it('fails when no runtime is configured', async () => {
    const result = await lane({})
    expect(result.code).toBe(1)
    expect(result.err).toContain('required lane cannot run')
  })

  it('fails when both a running runtime and a stage plan are named', async () => {
    const result = await lane({
      EZCLASSIFY_AUTHORING_URL: 'http://127.0.0.1:1',
      EZCLASSIFY_STAGE_PLAN: '/nonexistent/stage.json',
    })
    expect(result.code).toBe(1)
    expect(result.err).toContain('exactly one')
  })

  it('fails when the named runtime does not answer', async () => {
    const result = await lane({ EZCLASSIFY_AUTHORING_URL: 'http://127.0.0.1:1' })
    expect(result.code).toBe(1)
    expect(result.err).toContain('did not answer')
  })

  it('fails when the stage plan cannot be read', async () => {
    const result = await lane({ EZCLASSIFY_STAGE_PLAN: '/nonexistent/stage.json' })
    expect(result.code).toBe(1)
    expect(result.err).toContain('cannot be read')
  })

  it('starts the planned runtime, runs every suite on a draft of its composition, and passes', async () => {
    const result = await staged()
    expect(result.code).toBe(0)
    const suites = fs.readdirSync(path.join(repoRoot, 'scheme-folder', 'test-suites'))
    const runs = result.requests.filter((r) => r.url === '/v1/authoring/suites/run')
    expect(runs).toHaveLength(suites.length)
    expect(result.out).toContain(`${suites.length} of ${suites.length} suites passed`)
    // Every request carries the one session the drafts are held under.
    expect(new Set(result.requests.map((r) => r.session)).size).toBe(1)
  })

  it('sends a suite its scheme and access policy as the draft, by text', async () => {
    const result = await staged()
    const drafts = result.requests.filter((r) => r.url === '/v1/sandbox/ctx')
    const control = drafts.find((d) =>
      d.body.accessComponent?.access.includes('access-control-rules'),
    )
    expect(control?.body.scheme).toContain('id: access-control')
    expect(control?.body.accessComponent.layers).toBeUndefined()
  })

  it("sends a crosswalk suite both of the crosswalk's schemes, the suite's own primary", async () => {
    const result = await staged()
    const crosswalk = result.requests
      .filter((r) => r.url === '/v1/sandbox/ctx')
      .find((d) => d.body.crosswalkComponents?.[0].crosswalk.includes('id: cvss-31-to-40'))
    expect(crosswalk?.body.primaryScheme).toBe('cvss')
    expect(crosswalk?.body.schemes.map((s: { key: string }) => s.key).sort()).toEqual([
      'cvss',
      'cvss-v4',
    ])
  })

  it('fails and names the suite when a case fails', async () => {
    const result = await staged({ FAKE_FAIL: 'tlp-tests' })
    expect(result.code).toBe(1)
    expect(result.out).toMatch(/FAIL tlp-tests@1\.0\.0\.yaml: 2 passed, 1 failed/)
  })

  it('fails when the runtime refuses a draft', async () => {
    const result = await staged({ FAKE_REFUSE_DRAFTS: '1' })
    expect(result.code).toBe(1)
    expect(result.out).toContain('the draft was refused: does not compose')
  })

  it('writes the runtimes reports when asked, and refuses a report flag with no path', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'behavior-report-'))
    temps.push(dir)
    const report = path.join(dir, 'report.json')
    const written = await staged({}, ['--report', report])
    expect(written.code).toBe(0)
    const parsed = JSON.parse(fs.readFileSync(report, 'utf-8'))
    expect(parsed.engineVersion).toBe('9.9.9-fake')
    expect(parsed.runs.length).toBeGreaterThan(0)
    const bare = await lane({ EZCLASSIFY_AUTHORING_URL: 'http://127.0.0.1:1' }, ['--report'])
    expect(bare.code).toBe(1)
    expect(bare.err).toContain('--report needs a file path')
  })
})
