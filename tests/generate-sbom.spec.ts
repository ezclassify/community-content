/**
 * SBOM generator coverage.
 *
 * The SBOM is a compliance artifact: CI uploads it and scanners read it as
 * fact. These tests pin the two properties that make it worth reading. Every
 * component version is an exact resolved version, never a declared range, and
 * the inventory is the whole installed tree rather than only the direct
 * dependencies.
 */
import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

const repoRoot = path.resolve(__dirname, '..')
const lockfilePath = path.join(repoRoot, 'package-lock.json')

interface License {
  license?: { id: string }
  expression?: string
}

interface Component {
  name: string
  version: string
  purl: string
  licenses?: License[]
}

interface Sbom {
  serialNumber: string
  components: Component[]
}

/** Names and exact versions of every installed package in the lockfile. */
function lockfileEntries(): Map<string, string> {
  const lockfile = JSON.parse(fs.readFileSync(lockfilePath, 'utf-8')) as {
    packages?: Record<string, { name?: string; version?: string; link?: boolean }>
  }
  const entries = new Map<string, string>()
  for (const [key, entry] of Object.entries(lockfile.packages ?? {})) {
    if (key === '' || entry.link) continue
    const marker = 'node_modules/'
    const index = key.lastIndexOf(marker)
    if (index < 0 || typeof entry.version !== 'string') continue
    entries.set(`${entry.name ?? key.slice(index + marker.length)}@${entry.version}`, entry.version)
  }
  return entries
}

/**
 * Run the real generator over this repository's lockfile. The document goes
 * to a throwaway path: `dist/sbom.json` is published, so a test run must not
 * rewrite it with a new timestamp. Only `npm run sbom` writes that file.
 */
function generate(): Sbom {
  const outPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ezclassify-sbom-')), 'sbom.json')
  execFileSync(
    process.execPath,
    [path.join(repoRoot, 'scripts/generate-sbom.mjs'), `--out=${outPath}`],
    { cwd: repoRoot, encoding: 'utf8' },
  )
  return JSON.parse(fs.readFileSync(outPath, 'utf-8')) as Sbom
}

/**
 * Run the real generator over a throwaway lockfile and read back what it
 * wrote, so the license shapes below are the shipped script's own output.
 */
function generateFrom(packages: Record<string, unknown>): Sbom {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ezclassify-sbom-'))
  const lockfile = path.join(dir, 'package-lock.json')
  const outPath = path.join(dir, 'sbom.json')
  fs.writeFileSync(
    lockfile,
    JSON.stringify({ name: 'fixture', lockfileVersion: 3, packages: { '': {}, ...packages } }),
  )
  execFileSync(
    process.execPath,
    [
      path.join(repoRoot, 'scripts/generate-sbom.mjs'),
      `--lockfile=${lockfile}`,
      `--out=${outPath}`,
    ],
    { cwd: repoRoot, encoding: 'utf8' },
  )
  return JSON.parse(fs.readFileSync(outPath, 'utf-8')) as Sbom
}

describe('license values', () => {
  it('emits an SPDX expression under `expression`, never as an identifier', () => {
    const sbom = generateFrom({
      'node_modules/dual-lib': { version: '1.0.0', license: '(MIT OR CC0-1.0)' },
      'node_modules/exception-lib': {
        version: '2.0.0',
        license: 'GPL-2.0 WITH Classpath-exception-2.0',
      },
    })
    expect(sbom.components.map((c) => c.licenses)).toEqual([
      [{ expression: '(MIT OR CC0-1.0)' }],
      [{ expression: 'GPL-2.0 WITH Classpath-exception-2.0' }],
    ])
  })

  it('keeps a bare identifier under `license.id`', () => {
    const sbom = generateFrom({ 'node_modules/plain-lib': { version: '1.0.0', license: 'MIT' } })
    expect(sbom.components[0]?.licenses).toEqual([{ license: { id: 'MIT' } }])
  })
})

// A native dependency install generates the ephemeral lock. Missing inventory
// is a setup failure, never a passing or skipped SBOM gate.
describe('the SBOM of this repository', () => {
  let sbom: Sbom
  beforeAll(() => {
    sbom = generate()
  })

  it('reports exact resolved versions, never declared ranges', () => {
    for (const component of sbom.components) {
      expect({ name: component.name, version: component.version }).toEqual({
        name: component.name,
        version: expect.stringMatching(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/) as unknown,
      })
      expect(component.purl.endsWith(`@${component.version}`)).toBe(true)
    }
  })

  it('inventories the whole installed tree, not just the direct dependencies', () => {
    const installed = lockfileEntries()
    const listed = new Set(sbom.components.map((c) => `${c.name}@${c.version}`))
    const missing = [...installed.keys()].filter((key) => !listed.has(key))
    expect(missing).toEqual([])
    expect(listed.size).toBeGreaterThan(50)
  })

  it('derives a stable serial number from the dependency tree', () => {
    expect(generate().serialNumber).toBe(sbom.serialNumber)
  })
})
