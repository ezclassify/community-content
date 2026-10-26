/**
 * Contract tests for `scripts/check-lockfile-portable.mjs`.
 *
 * First-party `resolved` origins and resolved URLs outside the portable
 * registry allowlist are refused. A first-party `integrity` hash without
 * `resolved` is allowed: content identity does not pin a registry origin.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const guard = resolve(repositoryRoot, 'scripts/check-lockfile-portable.mjs')

/**
 * Runs the guard against a throwaway lockfile via its `--lockfile` flag, so
 * these tests exercise the actual shipped script instead of a
 * reimplementation of its logic.
 */
function runGuardAgainst(packages: Record<string, unknown>): { status: number; output: string } {
  const dir = mkdtempSync(resolve(tmpdir(), 'ezclassify-lockfile-portable-'))
  const lockfilePath = resolve(dir, 'package-lock.json')
  writeFileSync(
    lockfilePath,
    JSON.stringify({ name: 'fixture', lockfileVersion: 3, packages: { '': {}, ...packages } }),
  )
  try {
    const output = execFileSync(process.execPath, [guard, `--lockfile=${lockfilePath}`], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    })
    return { status: 0, output }
  } catch (error) {
    const err = error as { status?: number; stdout?: string; stderr?: string }
    return { status: err.status ?? 1, output: `${err.stdout ?? ''}${err.stderr ?? ''}` }
  }
}

describe('lockfile portability guard', () => {
  it('passes a clean lockfile: pinned third-party, unpinned first-party', () => {
    const result = runGuardAgainst({
      'node_modules/settled-lib': {
        version: '1.2.3',
        resolved: 'https://registry.npmjs.org/settled-lib/-/settled-lib-1.2.3.tgz',
        integrity: 'sha512-abc==',
      },
      'node_modules/@ezclassify/rest-client': { name: '@ezclassify/rest-client', version: '1.0.0' },
    })
    expect(result.status).toBe(0)
    expect(result.output).toContain('package-lock.json is portable')
  })

  it('refuses a loopback resolved URL', () => {
    const result = runGuardAgainst({
      'node_modules/some-lib': {
        version: '1.0.0',
        resolved: 'http://localhost:4873/some-lib/-/some-lib-1.0.0.tgz',
      },
    })
    expect(result.status).toBe(1)
    expect(result.output).toContain('not a portable registry origin')
  })

  it('refuses a private-network registry URL without the localhost hostname', () => {
    const result = runGuardAgainst({
      'node_modules/some-lib': {
        version: '1.0.0',
        resolved: 'http://192.168.1.5:4873/some-lib/-/some-lib-1.0.0.tgz',
      },
    })
    expect(result.status).toBe(1)
    expect(result.output).toContain('not a portable registry origin')
  })

  it('refuses a private registry on an ordinary host and port', () => {
    // Portability depends on the registry origin, including an ordinary host
    // and port outside the allowlist.
    const result = runGuardAgainst({
      'node_modules/some-lib': {
        version: '1.0.0',
        resolved: 'https://registry.example.internal/some-lib/-/some-lib-1.0.0.tgz',
      },
    })
    expect(result.status).toBe(1)
    expect(result.output).toContain('not a portable registry origin')
  })

  it('refuses a first-party `resolved` origin', () => {
    const result = runGuardAgainst({
      'node_modules/@ezclassify/rest-client': {
        name: '@ezclassify/rest-client',
        version: '1.0.0',
        resolved: 'https://npm.pkg.github.com/@ezclassify/rest-client/-/rest-client-1.0.0.tgz',
      },
    })
    expect(result.status).toBe(1)
    expect(result.output).toContain('pins a first-party `resolved` origin')
  })

  it('allows a first-party `integrity` hash with no `resolved`', () => {
    // A content hash preserves artifact identity without fixing its registry
    // origin, so it does not violate lockfile portability.
    const result = runGuardAgainst({
      'node_modules/@ezclassify/rest-client': {
        name: '@ezclassify/rest-client',
        version: '1.0.0',
        integrity: 'sha512-abc==',
      },
    })
    expect(result.status).toBe(0)
    expect(result.output).toContain('package-lock.json is portable')
  })
})
