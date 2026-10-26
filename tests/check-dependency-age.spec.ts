/**
 * Contract tests for `scripts/check-dependency-age.mjs`, the third-party
 * publish-date quarantine and trusted first-party registry exemption.
 *
 * Hermetic: the guard is pointed at a throwaway lockfile whose `resolved`
 * URLs name a local http server standing in for a registry, so no test
 * reaches the network.
 */
import { execFile } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const guard = resolve(repositoryRoot, 'scripts/check-dependency-age.mjs')

const DAY_MS = 86_400_000
const publishTimes: Record<string, Record<string, string>> = {}

/** Per-request delay the fake registry applies, in milliseconds. */
let responseDelayMs = 0

/** Requests the fake registry is holding open right now, and the peak seen. */
let inFlight = 0
let peakInFlight = 0

let server: Server
let registry: string

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString()
}

beforeAll(async () => {
  server = createServer((req, res) => {
    const name = decodeURIComponent((req.url ?? '/').slice(1))
    const times = publishTimes[name]
    if (!times) {
      res.writeHead(404).end('{}')
      return
    }
    inFlight += 1
    peakInFlight = Math.max(peakInFlight, inFlight)
    const answer = (): void => {
      inFlight -= 1
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ name, time: times }))
    }
    if (responseDelayMs > 0) setTimeout(answer, responseDelayMs)
    else answer()
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const address = server.address()
  if (address === null || typeof address === 'string')
    throw new Error('fake registry did not bind a port')
  registry = `http://127.0.0.1:${address.port}`
})

afterAll(async () => {
  await new Promise<void>((done, fail) => server.close((err) => (err ? fail(err) : done())))
})

/**
 * Write a lockfile naming the given packages and return its path. Each entry
 * is `[name, version]`; `resolved` points at the fake registry unless
 * `resolved: null` is passed, which omits the field the way a
 * `--package-lock-only` resolve does for most entries.
 */
function lockfileWith(entries: Array<[string, string, { resolved?: string | null }?]>): string {
  const dir = mkdtempSync(resolve(tmpdir(), 'ezclassify-dependency-age-'))
  const packages: Record<string, unknown> = {
    '': { name: 'fixture', version: '1.0.0' },
  }
  for (const [name, version, options] of entries) {
    const resolved =
      options?.resolved === null
        ? undefined
        : (options?.resolved ?? `${registry}/${name}/-/${name}-${version}.tgz`)
    packages[`node_modules/${name}`] = { version, ...(resolved ? { resolved } : {}) }
  }
  const path = resolve(dir, 'package-lock.json')
  writeFileSync(path, JSON.stringify({ name: 'fixture', lockfileVersion: 3, packages }))
  return path
}

/**
 * Run the guard against a lockfile.
 *
 * Asynchronous on purpose: the fake registry is served from this same
 * process, so a synchronous spawn would block the event loop and the guard's
 * fetch would never be answered.
 */
function run(
  lockfile: string,
  envOverrides: Record<string, string> = {},
): Promise<{ status: number; output: string }> {
  return new Promise((settle) => {
    execFile(
      process.execPath,
      [guard],
      {
        cwd: repositoryRoot,
        env: {
          ...process.env,
          EZCLASSIFY_DEPENDENCY_AGE_LOCKFILE: lockfile,
          EZCLASSIFY_DEPENDENCY_AGE_REGISTRY: registry,
          // Declares the fake registry as first-party by default so most
          // tests can exercise the exemption without touching the host's
          // npm config. The impostor-registry test overrides this to a
          // registry the entry does NOT resolve from, which is the case the
          // exemption must reject.
          EZCLASSIFY_DEPENDENCY_AGE_FIRST_PARTY_REGISTRIES: registry,
          ...envOverrides,
        },
        encoding: 'utf8',
      },
      (error, stdout, stderr) => {
        const status = error === null ? 0 : ((error as { code?: number }).code ?? 1)
        settle({ status, output: `${stdout}${stderr}` })
      },
    )
  })
}

describe('third-party dependency quarantine guard', () => {
  it('asks the registry about many packages concurrently, not one round trip at a time', async () => {
    const names = Array.from({ length: 16 }, (_, index) => `slow-lib-${index}`)
    for (const name of names) publishTimes[name] = { '1.0.0': isoDaysAgo(30) }
    const lockfile = lockfileWith(names.map((name) => [name, '1.0.0'] as [string, string]))

    // Held open long enough that a serial guard could only ever have one
    // request outstanding. Counting them at the server is deterministic where
    // timing the whole run is not.
    responseDelayMs = 50
    peakInFlight = 0
    const result = await run(lockfile)
    responseDelayMs = 0

    expect(result.status).toBe(0)
    expect(peakInFlight).toBeGreaterThan(1)
  })

  it('accepts a third-party package published outside the window', async () => {
    publishTimes['settled-lib'] = { '1.2.3': isoDaysAgo(30) }
    const result = await run(lockfileWith([['settled-lib', '1.2.3']]))
    expect(result.status).toBe(0)
    expect(result.output).toContain('Dependency quarantine passed')
  })

  it('rejects a third-party package published inside the window', async () => {
    publishTimes['fresh-lib'] = { '9.9.9': isoDaysAgo(1) }
    const result = await run(lockfileWith([['fresh-lib', '9.9.9']]))
    expect(result.status).toBe(1)
    expect(result.output).toContain('fresh-lib@9.9.9')
    expect(result.output).toContain('published less than 7 day(s) ago')
  })

  it('exempts a first-party package served from a trusted registry', async () => {
    // Trusted first-party packages are exempt from the third-party window,
    // including a version published moments ago.
    publishTimes['@ezclassify/rest-client'] = { '1.0.0': new Date().toISOString() }
    const result = await run(lockfileWith([['@ezclassify/rest-client', '1.0.0']]))
    expect(result.status).toBe(0)
    expect(result.output).toContain('Dependency quarantine passed')
  })

  it('exempts a first-party package with no resolved URL, the shape deps:relock normalizes to', async () => {
    // `deps:relock --normalize` deliberately strips `resolved`/`integrity`
    // from first-party lockfile entries so the committed lockfile carries no
    // machine-local registry URL. The guard must still recognize these as
    // ours via the configured first-party registry, not treat the missing
    // `resolved` as grounds to check them.
    publishTimes['@ezclassify/normalized'] = { '1.0.0': new Date().toISOString() }
    const result = await run(
      lockfileWith([['@ezclassify/normalized', '1.0.0', { resolved: null }]]),
    )
    expect(result.status).toBe(0)
    expect(result.output).toContain('Dependency quarantine passed')
  })

  it('CATCHES an @ezclassify-named package served from a registry that is not first-party', async () => {
    // Exemption requires both a first-party package name and a trusted
    // registry origin. A matching name from an untrusted registry remains
    // subject to quarantine.
    publishTimes['@ezclassify/impostor'] = { '1.0.0': isoDaysAgo(1) }
    const result = await run(
      lockfileWith([['@ezclassify/impostor', '1.0.0']]),
      // The entry resolves from the fake registry, but this run declares a
      // DIFFERENT registry as first-party, so the name match alone must not
      // exempt it.
      { EZCLASSIFY_DEPENDENCY_AGE_FIRST_PARTY_REGISTRIES: 'https://not-the-real-registry.example' },
    )
    expect(result.status).toBe(1)
    expect(result.output).toContain('@ezclassify/impostor@1.0.0')
    expect(result.output).toContain('published less than 7 day(s) ago')
  })

  it('exempts a first-party entry when public npm is the configured scope registry', async () => {
    // A refusal falls back to the fake default registry, so this check never
    // needs to fetch package availability from public npm.
    publishTimes['@ezclassify/pinned-origin'] = { '1.0.0': isoDaysAgo(1) }
    const result = await run(
      lockfileWith([['@ezclassify/pinned-origin', '1.0.0', { resolved: null }]]),
      { EZCLASSIFY_DEPENDENCY_AGE_FIRST_PARTY_REGISTRIES: 'https://registry.npmjs.org' },
    )
    expect(result.status).toBe(0)
    expect(result.output).toContain('Dependency quarantine passed')

    const pinned = await run(
      lockfileWith([
        [
          '@ezclassify/pinned-origin',
          '1.0.0',
          {
            resolved:
              'https://registry.npmjs.org/@ezclassify/pinned-origin/-/pinned-origin-1.0.0.tgz',
          },
        ],
      ]),
      { EZCLASSIFY_DEPENDENCY_AGE_FIRST_PARTY_REGISTRIES: 'https://registry.npmjs.org' },
    )
    expect(pinned.status).toBe(0)
    const npmDirectory = mkdtempSync(resolve(tmpdir(), 'ezclassify-npm-config-'))
    const npm = resolve(npmDirectory, 'npm')
    writeFileSync(
      npm,
      `#!/bin/sh\nif [ "$3" = "@ezclassify:registry" ]; then echo undefined; else echo ${registry}; fi\n`,
    )
    chmodSync(npm, 0o755)
    const defaultRegistry = await run(lockfileWith([['@ezclassify/pinned-origin', '1.0.0']]), {
      EZCLASSIFY_DEPENDENCY_AGE_FIRST_PARTY_REGISTRIES: '',
      PATH: `${npmDirectory}:${process.env.PATH}`,
    })
    expect(defaultRegistry.status).toBe(0)
    expect(defaultRegistry.output).toContain('Dependency quarantine passed')
  })

  it('checks entries that carry no resolved URL', async () => {
    // A lockfile entry without `resolved` still identifies a package whose
    // version must pass quarantine, including nested dependency entries.
    publishTimes['lock-only-lib'] = { '3.0.0': isoDaysAgo(1) }
    const dir = mkdtempSync(resolve(tmpdir(), 'ezclassify-dependency-age-'))
    const path = resolve(dir, 'package-lock.json')
    writeFileSync(
      path,
      JSON.stringify({
        name: 'fixture',
        lockfileVersion: 3,
        packages: {
          '': { name: 'fixture', version: '1.0.0' },
          'libs/demo': { name: 'demo', version: '1.0.0' },
          'libs/demo/node_modules/lock-only-lib': { version: '3.0.0' },
        },
      }),
    )
    const result = await run(path)
    expect(result.status).toBe(1)
    expect(result.output).toContain('lock-only-lib@3.0.0')
  })

  it('fails when the registry reports no publish date for a version', async () => {
    publishTimes['silent-lib'] = { '1.0.0': isoDaysAgo(30) }
    const result = await run(lockfileWith([['silent-lib', '2.0.0']]))
    expect(result.status).toBe(1)
    expect(result.output).toContain('no publish date for silent-lib@2.0.0')
  })

  it('fails loudly when the registry cannot be reached, without discarding a violation found alongside it', async () => {
    // An unreachable registry must not suppress violations found for other
    // packages in the same lockfile.
    publishTimes['fresh-lib-2'] = { '4.4.4': isoDaysAgo(1) }
    const path = resolve(
      mkdtempSync(resolve(tmpdir(), 'ezclassify-dependency-age-')),
      'package-lock.json',
    )
    writeFileSync(
      path,
      JSON.stringify({
        name: 'fixture',
        lockfileVersion: 3,
        packages: {
          '': { name: 'fixture', version: '1.0.0' },
          // Points at a port nothing is listening on.
          'node_modules/unreachable-lib': {
            version: '1.2.3',
            resolved: 'http://127.0.0.1:1/unreachable-lib/-/unreachable-lib-1.2.3.tgz',
          },
          'node_modules/fresh-lib-2': {
            version: '4.4.4',
            resolved: `${registry}/fresh-lib-2/-/fresh-lib-2-4.4.4.tgz`,
          },
        },
      }),
    )
    const result = await run(path)
    expect(result.status).toBe(1)
    expect(result.output).toContain('Could not reach http://127.0.0.1:1')
    // The real violation, found after the unreachable entry, must still be
    // reported rather than being swallowed by the earlier failure.
    expect(result.output).toContain('fresh-lib-2@4.4.4')
    expect(result.output).toContain('published less than 7 day(s) ago')
  })

  it('errors loudly on a differently-named first-party trust env var instead of silently ignoring it', async () => {
    publishTimes['settled-lib'] = { '1.2.3': isoDaysAgo(30) }
    const result = await run(lockfileWith([['settled-lib', '1.2.3']]), {
      // A plausible typo in the recognized trust variable must be reported
      // rather than treated as an unset configuration.
      EZCLASSIFY_DEPENDENCY_AGE_FIRST_PARTY_REGISTRY: registry,
    })
    expect(result.status).toBe(1)
    expect(result.output).toContain('Unrecognized first-party trust env var')
    expect(result.output).toContain('EZCLASSIFY_DEPENDENCY_AGE_FIRST_PARTY_REGISTRY')
  })
})
