/**
 * Cross-scheme document conformance.
 *
 * Every published scheme is held to the same document contract, discovered
 * from disk rather than listed, so a scheme added to `scheme-folder/schemes/`
 * is checked the moment it lands. This is the suite that catches a defect
 * nobody wrote a scheme-specific test for.
 *
 * This public content repository checks authored documents directly. Engine
 * evaluation belongs to the declarative behavioral suites, run by the
 * separately supplied EzClassify CLI.
 */
import * as fs from 'fs'
import * as path from 'path'
import { SchemeDocument, itSatisfiesTheSchemeContract, views } from './helpers/scheme-document'

const schemesDir = path.resolve(__dirname, '../scheme-folder/schemes')

/**
 * Every definition in the scheme folder's `schemes/` directory. Files are named
 * `<id>@<version>.yaml` per the scheme-folder convention.
 *
 * @param root - The directory to read.
 */
function discoverSchemes(root: string): Array<{ id: string; version: string; file: string }> {
  return fs
    .readdirSync(root)
    .map((name) => ({ name, match: /^(.+)@(.+)\.ya?ml$/.exec(name) }))
    .filter((entry): entry is { name: string; match: RegExpExecArray } => entry.match !== null)
    .map((entry) => ({
      id: entry.match[1],
      version: entry.match[2],
      file: path.join(root, entry.name),
    }))
}

const discovered = discoverSchemes(schemesDir)

// The full 1.0 community catalog. Everything this repository carries is
// published: there is no draft or held-back tier.
const publishedSchemes = [
  'cedar-valley@1.0.0',
  'cedar-valley-handling@1.0.0',
  'cedar-valley-protection@1.0.0',
  'cvss@3.1.0',
  'cvss-v4@4.0.0',
  'tlp@2.0.0',
]

describe('cross-scheme document conformance', () => {
  it('discovers exactly the published schemes', () => {
    // Set equality, not containment: adding or removing a file under
    // scheme-folder/schemes/ has to be reflected here in the same commit.
    expect(discovered.map((entry) => `${entry.id}@${entry.version}`).sort()).toEqual(
      [...publishedSchemes].sort(),
    )
  })

  describe.each(discovered)('scheme: $id', ({ id, file }) => {
    const document = new SchemeDocument(file)

    // Schema validity, filename identity, default views, and the concept
    // reference invariants are the shared document contract every per-scheme
    // spec is held to. Asserted once, here too.
    itSatisfiesTheSchemeContract(document)

    it('declares the id its filename claims', () => {
      expect(document.scheme.id).toBe(id)
    })

    it('declares at least one category, one concept, and one render format', () => {
      expect(document.scheme.data.categories.length).toBeGreaterThanOrEqual(1)
      expect(document.concepts.length).toBeGreaterThanOrEqual(1)
      expect((document.scheme.render?.formats ?? []).length).toBeGreaterThanOrEqual(1)
    })

    it('names defaults among its declared formats or surface views', () => {
      const formats = (document.scheme.render?.formats ?? []).map((format) => format.id)
      const surfaces = document.scheme.render?.surfaces
      if (!surfaces) {
        expect(formats).toContain(document.scheme.render?.default)
        return
      }
      expect(document.scheme.render?.default).toBeUndefined()
      for (const surface of surfaces) {
        const defaults =
          typeof surface.default === 'string'
            ? [surface.default]
            : [surface.default.whole, surface.default.part ?? surface.default.whole]
        for (const id of defaults) expect(surface.views.map((view) => view.id)).toContain(id)
        for (const view of surface.views) expect(formats).toContain(view.format)
      }
    })

    // An alias or view that the scheme's own token separator would split is
    // unreachable: by the time matching happens it is two tokens, and neither
    // one is the alias. The check is cheap and catches an authoring slip that
    // no schema rule can see.
    it('writes no alias or view its own parse separator would split', () => {
      const separator = document.scheme.parse?.separator
      if (separator === undefined) return
      const splits = new RegExp(separator)
      const unreachable = document.concepts.flatMap((concept) => [
        ...(concept.aliases ?? [])
          .filter((alias) => splits.test(alias))
          .map((alias) => `${concept.id} alias ${JSON.stringify(alias)}`),
        ...Object.entries(views(concept))
          .filter(([, value]) => splits.test(value))
          .map(([name, value]) => `${concept.id} view ${name} ${JSON.stringify(value)}`),
      ])
      expect(unreachable).toEqual([])
    })

    it('gives every concept a unique id', () => {
      const ids = document.concepts.map((concept) => concept.id)
      expect(ids).toEqual([...new Set(ids)])
    })

    it('targets only concepts it declares from every rule', () => {
      const declared = new Set(document.concepts.map((concept) => concept.id))
      const broken = (document.scheme.rules ?? []).flatMap((rule) =>
        (typeof rule.target === 'string' ? [rule.target] : (rule.target ?? []))
          .filter((target) => !declared.has(target))
          .map((target) => `${rule.id} -> ${target}`),
      )
      expect(broken).toEqual([])
    })
  })
})
