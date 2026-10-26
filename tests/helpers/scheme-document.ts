/**
 * Shared reader for the per-scheme document specs.
 *
 * Every per-scheme spec asks the same two kinds of question: does this document
 * satisfy the published JSON Schema, and does it declare the vocabulary its
 * README promises. Both are answered from the authored YAML with
 * `@ezclassify/validator`, the schema-only validator published from the
 * `contracts` repository. Nothing here loads a scheme, resolves a layer, or
 * evaluates a rule. That is engine work, the engine is proprietary, and this
 * repository is public content that may not depend on it.
 *
 * The practical consequence, and the reason this file exists: a community
 * contributor can clone this repo, run `npm install`, and check their scheme
 * with no license and no runtime.
 */
import * as path from 'path'
import { parseDocument, validateFile } from '@ezclassify/validator'

/** A category as authored under `scheme.data.categories`. */
export interface AuthoredCategory {
  id: string
  label?: string
  required?: boolean
  single?: boolean
  scopes?: string[]
  rollup?: string
  position?: number
}

/**
 * A concept as authored under `scheme.data.concepts.inline`.
 *
 * `views` is authored either as a map keyed by view name or as a plain string.
 * The string form is a schema-sanctioned shorthand for `{ default: "..." }`
 * and several schemes here use it; read it through {@link defaultView} rather
 * than reaching for `views.default` directly.
 */
export interface AuthoredConcept {
  id: string
  name?: string
  definition?: string
  /** Where in the governing document this concept was read from. Provenance only. */
  citation?: string
  aliases?: string[]
  categories?: string[]
  parents?: string[]
  rank?: number
  position?: number
  views?: string | Record<string, string>
  color?: { background: string; text: string }
}

/**
 * The `default` view of a concept, expanding the plain-string shorthand the
 * same way the engine loader does.
 *
 * @param concept - The authored concept.
 * @returns The default view text, or `undefined` when none is declared.
 */
export function defaultView(concept: AuthoredConcept): string | undefined {
  if (typeof concept.views === 'string') return concept.views
  return concept.views?.default
}

/**
 * One named view of a concept. The string shorthand declares only `default`,
 * so any other view name is absent by construction, which is the loader's
 * behavior too: it does not materialize phantom view keys.
 *
 * @param concept - The authored concept.
 * @param view - The view name to read.
 */
export function view(concept: AuthoredConcept, view: string): string | undefined {
  if (typeof concept.views === 'string') return view === 'default' ? concept.views : undefined
  return concept.views?.[view]
}

/**
 * Every named view of a concept, expanding the plain-string shorthand into the
 * single `default` view it stands for.
 *
 * @param concept - The authored concept.
 * @returns View name to view text, empty when the concept declares none.
 */
export function views(concept: AuthoredConcept): Record<string, string> {
  if (typeof concept.views === 'string') return { default: concept.views }
  return concept.views ?? {}
}

/** A rule as authored under `scheme.rules`. */
export interface AuthoredRule {
  id: string
  action: string
  message?: string
  target?: string | string[]
}

/** The body inside the top-level `scheme:` envelope, as authored. */
export interface AuthoredScheme {
  id: string
  version: string
  name: string
  data: {
    categories: AuthoredCategory[]
    concepts: { inline: AuthoredConcept[] }
  }
  rules?: AuthoredRule[]
  render?: {
    color_from?: string
    formats?: Array<Record<string, unknown>>
    default?: string
    surfaces?: Array<{
      surface: string
      default: string | { whole: string; part?: string }
      views: Array<{ id: string; format: string }>
    }>
  }
  parse?: { separator?: string } & Record<string, unknown>
}

/**
 * One scheme document, read once and queried by the spec that owns it.
 */
export class SchemeDocument {
  readonly file: string
  readonly scheme: AuthoredScheme

  constructor(file: string) {
    this.file = file
    this.scheme = (parseDocument(file) as { scheme: AuthoredScheme }).scheme
  }

  /** Ids of every declared category, in authored order. */
  get categoryIds(): string[] {
    return this.scheme.data.categories.map((category) => category.id)
  }

  /** Every inline concept, in authored order. */
  get concepts(): AuthoredConcept[] {
    return this.scheme.data.concepts.inline
  }

  /** One category by id, or `undefined` when it is not declared. */
  category(id: string): AuthoredCategory | undefined {
    return this.scheme.data.categories.find((category) => category.id === id)
  }

  /** Concepts declared as members of one category, in authored order. */
  conceptsIn(categoryId: string): AuthoredConcept[] {
    return this.concepts.filter((concept) => (concept.categories ?? []).includes(categoryId))
  }

  /** The default view of every concept in one category, in authored order. */
  defaultViewsIn(categoryId: string): (string | undefined)[] {
    return this.conceptsIn(categoryId).map(defaultView)
  }

  /** One rule by id, or `undefined` when it is not declared. */
  rule(id: string): AuthoredRule | undefined {
    return (this.scheme.rules ?? []).find((rule) => rule.id === id)
  }
}

/**
 * Read a scheme document from the repository's `scheme-folder/`.
 *
 * @param relativePath - Path under `scheme-folder/`, for example
 *   `schemes/tlp@2.0.0.yaml`.
 */
export function schemeDocument(relativePath: string): SchemeDocument {
  return new SchemeDocument(path.resolve(__dirname, '../../scheme-folder', relativePath))
}

/**
 * The checks every published scheme document owes, registered as real `it`
 * blocks so a failure names the document and the invariant rather than one
 * opaque assertion.
 *
 * @param document - The document under test.
 */
export function itSatisfiesTheSchemeContract(document: SchemeDocument): void {
  it('validates against the published scheme schema', () => {
    const result = validateFile(document.file, 'scheme')
    expect(result.errors).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('declares the identity its filename claims', () => {
    expect(path.basename(document.file)).toBe(
      `${document.scheme.id}@${document.scheme.version}.yaml`,
    )
  })

  it('gives every concept a default view and at least one category', () => {
    for (const concept of document.concepts) {
      expect(concept.id).toBeTruthy()
      expect(defaultView(concept)).toBeDefined()
      expect((concept.categories ?? []).length).toBeGreaterThan(0)
    }
  })

  it('points every concept at a category the document declares', () => {
    const declared = new Set(document.categoryIds)
    for (const concept of document.concepts) {
      for (const categoryId of concept.categories ?? []) {
        expect({ concept: concept.id, category: categoryId }).toEqual({
          concept: concept.id,
          category: declared.has(categoryId) ? categoryId : `UNDECLARED:${categoryId}`,
        })
      }
    }
  })

  it('points every concept parent at a concept the document declares', () => {
    const declared = new Set(document.concepts.map((concept) => concept.id))
    for (const concept of document.concepts) {
      for (const parentId of concept.parents ?? []) {
        expect({ concept: concept.id, parent: parentId }).toEqual({
          concept: concept.id,
          parent: declared.has(parentId) ? parentId : `UNDECLARED:${parentId}`,
        })
      }
    }
  })
}
