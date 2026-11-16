/**
 * Document contract for the two CVSS crosswalks.
 *
 * These assertions read the authored crosswalk and scheme YAML directly. What a
 * translation produces is engine behavior, stated in the suites
 * `scheme-folder/test-suites/cvss-31-to-40-tests@1.0.0.yaml` and
 * `cvss-40-to-31-tests@1.0.0.yaml`, which the EzClassify CLI runs. This file
 * catches the authoring mistakes a contributor can make without a CLI: a
 * mapping that names a metric value its scheme does not declare, two
 * decisions with one id, or a source value left without a decision.
 */
import * as path from 'path'
import { parseDocument } from '@ezclassify/validator'
import { schemeDocument, type SchemeDocument } from './helpers/scheme-document'

interface Ref {
  category: string
  concept: string
}

interface Mapping {
  id: string
  source: Ref
  targets?: Ref[]
  disposition: string
}

interface Candidate {
  id: string
  when?: { any?: Ref[]; all?: Ref[]; none?: Ref[] }
  score?: Ref[]
  sources?: Ref[]
  targets?: Ref[]
  mappings?: Mapping[]
}

interface Crosswalk {
  id: string
  version: string
  source_scheme: { id: string; version: string }
  target_scheme: { id: string; version: string }
  mappings: Mapping[]
  selections?: Array<{ id: string; candidates: Candidate[] }>
}

const folder = path.resolve(__dirname, '../scheme-folder')

function crosswalk(file: string): Crosswalk {
  return (parseDocument(path.join(folder, 'crosswalks', file)) as { crosswalk: Crosswalk })
    .crosswalk
}

const schemes: Record<string, SchemeDocument> = {
  'cvss@3.1.0': schemeDocument('schemes/cvss@3.1.0.yaml'),
  'cvss-v4@4.0.0': schemeDocument('schemes/cvss-v4@4.0.0.yaml'),
}

/** Every mapping, top-level and inside selection candidates. */
function allMappings(doc: Crosswalk): Mapping[] {
  return [
    ...doc.mappings,
    ...(doc.selections ?? []).flatMap((selection) =>
      selection.candidates.flatMap((candidate) => candidate.mappings ?? []),
    ),
  ]
}

/** Every reference to the source scheme, and every reference to the target scheme. */
function references(doc: Crosswalk): { source: Ref[]; target: Ref[] } {
  const source: Ref[] = []
  const target: Ref[] = []
  for (const mapping of allMappings(doc)) {
    source.push(mapping.source)
    target.push(...(mapping.targets ?? []))
  }
  for (const selection of doc.selections ?? []) {
    for (const candidate of selection.candidates) {
      const when = candidate.when ?? {}
      source.push(
        ...(when.any ?? []),
        ...(when.all ?? []),
        ...(when.none ?? []),
        ...(candidate.score ?? []),
        ...(candidate.sources ?? []),
      )
      target.push(...(candidate.targets ?? []))
    }
  }
  return { source, target }
}

/** `category/concept` for every concept the scheme declares in that category. */
function declared(scheme: SchemeDocument): Set<string> {
  return new Set(
    scheme.concepts.flatMap((concept) =>
      (concept.categories ?? []).map((category) => `${category}/${concept.id}`),
    ),
  )
}

const key = (ref: Ref): string => `${ref.category}/${ref.concept}`

describe.each([
  {
    file: 'cvss-31-to-40@1.0.0.yaml',
    id: 'cvss-31-to-40',
    source: 'cvss@3.1.0',
    target: 'cvss-v4@4.0.0',
  },
  {
    file: 'cvss-40-to-31@1.0.0.yaml',
    id: 'cvss-40-to-31',
    source: 'cvss-v4@4.0.0',
    target: 'cvss@3.1.0',
  },
])('crosswalk $id', ({ file, id, source, target }) => {
  const doc = crosswalk(file)

  it('runs between the two CVSS schemes this folder ships', () => {
    expect(doc.id).toBe(id)
    expect(doc.version).toBe('1.0.0')
    expect(`${doc.source_scheme.id}@${doc.source_scheme.version}`).toBe(source)
    expect(`${doc.target_scheme.id}@${doc.target_scheme.version}`).toBe(target)
  })

  it('names only metric values its two schemes declare', () => {
    const refs = references(doc)
    const sourceValues = declared(schemes[source])
    const targetValues = declared(schemes[target])
    expect(refs.source.map(key).filter((ref) => !sourceValues.has(ref))).toEqual([])
    expect(refs.target.map(key).filter((ref) => !targetValues.has(ref))).toEqual([])
  })

  it('gives every decision its own id', () => {
    const ids = allMappings(doc).map((mapping) => mapping.id)
    expect(ids.filter((value, index) => ids.indexOf(value) !== index)).toEqual([])
  })
})

describe('crosswalk cvss-31-to-40 coverage', () => {
  // Partial means partial output, not partial review: every CVSS 3.1 value has
  // a carry, review or omit decision, so no 3.1 vector comes back unmapped.
  it('decides every CVSS 3.1 metric value exactly once', () => {
    const decided = crosswalk('cvss-31-to-40@1.0.0.yaml').mappings.map((m) => key(m.source))
    expect([...decided].sort()).toEqual([...declared(schemes['cvss@3.1.0'])].sort())
  })
})

describe('crosswalk cvss-40-to-31 coverage', () => {
  // The rubric derives the 3.1 vector from the Base and Threat metrics; every
  // other metric value, Not Defined included, has an explicit omit. Only the
  // qualitative severity rating has no rule, because it is not vector data.
  it('decides every CVSS 4.0 metric value except the severity rating', () => {
    const decided = new Set(references(crosswalk('cvss-40-to-31@1.0.0.yaml')).source.map(key))
    const expected = [...declared(schemes['cvss-v4@4.0.0'])]
      .filter((ref) => !ref.startsWith('severity/'))
      .sort()
    expect([...decided].sort()).toEqual(expected)
  })
})
