/**
 * Contract tests for `scripts/check-dependency-licenses.mjs`.
 *
 * The package declares no production dependencies, so a production-only scan
 * would inspect nothing and pass. These tests pin that the gate inspects the
 * whole tree it is given, and that the build-tooling allowance does not leak
 * into the set a consumer would actually receive.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const guard = resolve(repositoryRoot, 'scripts/check-dependency-licenses.mjs')

interface Entry {
  version: string
  license?: string
  dev?: boolean
  /** Written onto the lockfile entry itself, which the gate prefers. */
  lockfileLicense?: unknown
}

/**
 * Run the gate against a throwaway lockfile and installed tree. Each entry's
 * license is written into the fake `node_modules` copy, which is where the
 * real gate reads it when the lockfile does not carry one.
 */
function runGuardAgainst(entries: Record<string, Entry>): { status: number; output: string } {
  const dir = mkdtempSync(join(tmpdir(), 'ezclassify-dependency-licenses-'))
  const packages: Record<string, unknown> = { '': { name: 'fixture', version: '1.0.0' } }
  for (const [name, entry] of Object.entries(entries)) {
    const lockPath = `node_modules/${name}`
    packages[lockPath] = {
      version: entry.version,
      ...(entry.dev ? { dev: true } : {}),
      ...('lockfileLicense' in entry ? { license: entry.lockfileLicense } : {}),
    }
    mkdirSync(join(dir, lockPath), { recursive: true })
    writeFileSync(
      join(dir, lockPath, 'package.json'),
      JSON.stringify({
        name,
        version: entry.version,
        ...(entry.license ? { license: entry.license } : {}),
      }),
    )
  }
  const lockfile = join(dir, 'package-lock.json')
  writeFileSync(lockfile, JSON.stringify({ name: 'fixture', lockfileVersion: 3, packages }))
  try {
    const output = execFileSync(
      process.execPath,
      [guard, `--lockfile=${lockfile}`, `--modules=${dir}`],
      { cwd: repositoryRoot, encoding: 'utf8' },
    )
    return { status: 0, output }
  } catch (error) {
    const err = error as { status?: number; stdout?: string; stderr?: string }
    return { status: err.status ?? 1, output: `${err.stdout ?? ''}${err.stderr ?? ''}` }
  }
}

describe('dependency license gate', () => {
  it('passes a tree of permissive licenses', () => {
    const result = runGuardAgainst({
      'settled-lib': { version: '1.0.0', license: 'MIT', dev: true },
      'other-lib': { version: '2.0.0', license: 'Apache-2.0' },
    })
    expect(result.status).toBe(0)
    expect(result.output).toContain('all 2 third-party package(s)')
  })

  it('refuses a license outside the allowed set', () => {
    const result = runGuardAgainst({
      'copyleft-lib': { version: '1.0.0', license: 'GPL-3.0', dev: true },
    })
    expect(result.status).toBe(1)
    expect(result.output).toContain('copyleft-lib@1.0.0 is GPL-3.0')
  })

  it('refuses a package that declares no license at all', () => {
    const result = runGuardAgainst({ 'silent-lib': { version: '1.0.0', dev: true } })
    expect(result.status).toBe(1)
    expect(result.output).toContain('declares no license')
  })

  it('allows a build-tooling license on a dev entry and refuses it on a shipped one', () => {
    expect(
      runGuardAgainst({ 'build-tool': { version: '1.0.0', license: 'MPL-2.0', dev: true } }).status,
    ).toBe(0)

    const shipped = runGuardAgainst({ 'runtime-lib': { version: '1.0.0', license: 'MPL-2.0' } })
    expect(shipped.status).toBe(1)
    expect(shipped.output).toContain('held to the stricter set')
  })

  it('reads an OR expression as satisfied when either side is allowed', () => {
    const result = runGuardAgainst({
      'dual-lib': { version: '1.0.0', license: '(MIT OR CC0-1.0)', dev: true },
    })
    expect(result.status).toBe(0)
  })

  it('falls back to the installed copy when the lockfile license is not a string', () => {
    const result = runGuardAgainst({
      'odd-lib': {
        version: '1.0.0',
        license: 'MIT',
        dev: true,
        lockfileLicense: { type: 'MIT' },
      },
    })
    expect(result.status).toBe(0)
    expect(result.output).toContain('all 1 third-party package(s)')
  })
})
