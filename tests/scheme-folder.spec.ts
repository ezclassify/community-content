/**
 * Scheme-folder convention conformance.
 *
 * The sources live in a scheme folder (see scheme-folder/) per the convention:
 * schemes/ guides/ accesses/ contexts/ holding `<id>@<version>.yaml` files plus
 * a scheme-folder.yaml manifest.
 *
 * This runs the repository's own `npm run validate`, the same command a
 * contributor runs, so a manifest/file drift, an invalid definition, or a
 * test suite composing something this folder does not hold fails
 * `npm test` instead of waiting for CI.
 */
import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { parseDocument } from '@ezclassify/validator'

const repoRoot = path.resolve(__dirname, '..')
const folder = path.join(repoRoot, 'scheme-folder')
const manifestPath = path.join(folder, 'scheme-folder.yaml')

interface Manifest {
  name: string
  format: number
  schemes?: Array<{ id: string; versions: string[] }>
  guides?: Array<{ id: string; versions: string[] }>
  accesses?: Array<{ id: string; versions: string[] }>
  contexts?: Array<{ id: string; versions: string[] }>
}

const manifest = parseDocument(manifestPath) as Manifest

/** `<id>@<version>` for every definition file in one type directory. */
function refsOnDisk(dir: string): string[] {
  const typeDir = path.join(folder, dir)
  if (!fs.existsSync(typeDir)) return []
  return fs
    .readdirSync(typeDir)
    .filter((name) => /\.ya?ml$/.test(name))
    .map((name) => name.replace(/\.ya?ml$/, ''))
    .sort()
}

describe('scheme folder', () => {
  it('validates clean: every definition matches its schema and the manifest matches disk', () => {
    // Throws on a non-zero exit, which is the assertion. stdio is captured so a
    // failure reports the script's own error list rather than an opaque status.
    const output = execFileSync('node', ['scripts/validate-folder.mjs'], {
      cwd: repoRoot,
      encoding: 'utf-8',
    })
    expect(output).toContain('is valid')
  })

  it('inventories every published scheme', () => {
    expect(refsOnDisk('schemes')).toEqual([
      'cedar-valley-handling@1.0.0',
      'cedar-valley-protection@1.0.0',
      'cedar-valley@1.0.0',
      'cvss-v4@4.0.0',
      'cvss@3.1.0',
      'tlp@2.0.0',
    ])
    expect(refsOnDisk('guides')).toEqual([
      'cedar-valley-guide@1.0.0',
      'cedar-valley-handling-guide@1.0.0',
      'cedar-valley-protection-guide@1.0.0',
    ])
    expect(refsOnDisk('accesses')).toEqual([
      'cedar-valley-access@1.0.0',
      'cedar-valley-handling-access@1.0.0',
      'cedar-valley-protection-access@1.0.0',
    ])
    expect(refsOnDisk('contexts')).toEqual([
      'cedar-valley-handling@1.0.0',
      'cedar-valley-protection@1.0.0',
      'cedar-valley@1.0.0',
    ])
  })

  it('declares in the manifest exactly what is on disk', () => {
    const declared = (manifest.schemes ?? [])
      .flatMap((entry) => entry.versions.map((version) => `${entry.id}@${version}`))
      .sort()
    expect(declared).toEqual(refsOnDisk('schemes'))
    expect(
      (manifest.guides ?? [])
        .flatMap((entry) => entry.versions.map((version) => `${entry.id}@${version}`))
        .sort(),
    ).toEqual(refsOnDisk('guides'))
    expect(
      (manifest.accesses ?? [])
        .flatMap((entry) => entry.versions.map((version) => `${entry.id}@${version}`))
        .sort(),
    ).toEqual(refsOnDisk('accesses'))
    expect(
      (manifest.contexts ?? [])
        .flatMap((entry) => entry.versions.map((version) => `${entry.id}@${version}`))
        .sort(),
    ).toEqual(refsOnDisk('contexts'))
  })

  // The folder holds the four component directories, the manifest, and
  // `test-suites/`, all of which npm run validate checks. Anything else would
  // escape the validator.
  it('holds only component directories, the manifest, and the test suites', () => {
    const entries = fs
      .readdirSync(folder, { withFileTypes: true })
      // Dot-prefixed names are OS and tool droppings (.DS_Store and friends),
      // all gitignored. The convention declares no dot-prefixed member, so
      // skipping them keeps this red only for content someone actually added.
      .filter((entry) => !entry.name.startsWith('.'))
      .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name))
      .sort()
    expect(entries).toEqual([
      'accesses/',
      'contexts/',
      'guides/',
      'scheme-folder.yaml',
      'schemes/',
      'test-suites/',
    ])
  })
})
