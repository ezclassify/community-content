/**
 * THIRD-PARTY-NOTICES.md coverage. CI regenerates the file and diffs it, which
 * proves the committed copy is the generator's output but says nothing about
 * whether that output is complete. These tests pin what the notice has to
 * cover, so a change to the generator cannot quietly drop attribution when a
 * production dependency is added.
 */
import * as fs from 'fs'
import * as path from 'path'

const repoRoot = path.resolve(__dirname, '..')
const notices = fs.readFileSync(path.join(repoRoot, 'THIRD-PARTY-NOTICES.md'), 'utf-8')
const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf-8')) as {
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  files?: string[]
}

describe('THIRD-PARTY-NOTICES.md', () => {
  it('attributes every production dependency with a license', () => {
    for (const [name, range] of Object.entries(pkg.dependencies ?? {})) {
      expect(notices).toContain(`## ${name}`)
      expect(notices).toContain(`- Version range: \`${range}\``)
      const license = new RegExp(`## ${name}[\\s\\S]*?- License: \\S+`)
      expect(notices).toMatch(license)
    }
  })

  it('accounts for every peer dependency', () => {
    for (const name of Object.keys(pkg.peerDependencies ?? {})) {
      expect(notices).toContain(name)
    }
  })

  it('describes both halves of what the tarball ships', () => {
    expect(notices).toContain('dist/schemes/')
    expect(notices).toContain('dist/lib/')
  })

  it('lists the published file set', () => {
    for (const entry of pkg.files ?? []) {
      expect(notices).toContain(`\`${entry}\``)
    }
  })
})
