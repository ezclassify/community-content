/**
 * Document contract for the CVSS v4.0 scheme.
 *
 * Every assertion here is a question about the authored document: which
 * categories exist, which values belong to them, which metrics the
 * specification makes mandatory, where the Safety (S) value is allowed. None
 * of them needs an engine, so they are asked directly against the YAML,
 * alongside a schema check.
 *
 * What the scheme does when it evaluates a marking is a different question
 * with a different home: the test suite
 * `scheme-folder/test-suites/cvss-v4-tests@1.0.1.yaml`, which the EzClassify
 * CLI runs.
 */
import {
  schemeDocument,
  itSatisfiesTheSchemeContract,
  view,
} from '../../../../tests/helpers/scheme-document'

const cvssV4 = schemeDocument('schemes/cvss-v4@4.0.0.yaml')

/** The formats that emit a vector string, as opposed to a single rating. */
function vectorFormats(): Array<Record<string, unknown>> {
  return (cvssV4.scheme.render?.formats ?? []).filter((format) => format.id !== 'severity')
}

/** Does any concept in this category carry the given `metric` view? */
function categoryHasMetricValue(categoryId: string, metric: string): boolean {
  return cvssV4.conceptsIn(categoryId).some((concept) => view(concept, 'metric') === metric)
}

describe('CVSS v4.0 scheme document', () => {
  itSatisfiesTheSchemeContract(cvssV4)

  it('is the CVSS v4.0 scheme', () => {
    expect(cvssV4.scheme.id).toBe('cvss-v4')
    expect(cvssV4.scheme.version).toBe('4.0.0')
    expect(cvssV4.scheme.name).toBe('CVSS v4.0')
  })

  it('declares the Base metric categories', () => {
    expect(cvssV4.categoryIds).toEqual(
      expect.arrayContaining([
        'attack_vector',
        'attack_complexity',
        'attack_requirements',
        'privileges_required',
        'user_interaction',
        'vc_impact',
        'vi_impact',
        'va_impact',
        'sc_impact',
        'si_impact',
        'sa_impact',
      ]),
    )
  })

  // FIRST requires all eleven Base metrics in a v4.0 vector; there is no
  // partial Base score. Everything outside the Base group is optional, so a
  // vector that carries no Threat, Environmental, or Supplemental metric is a
  // complete CVSS-B assessment.
  it('requires every Base metric and no other', () => {
    const required = cvssV4.scheme.data.categories
      .filter((category) => category.required === true)
      .map((category) => category.id)
    expect(required).toEqual([
      'attack_vector',
      'attack_complexity',
      'attack_requirements',
      'privileges_required',
      'user_interaction',
      'vc_impact',
      'vi_impact',
      'va_impact',
      'sc_impact',
      'si_impact',
      'sa_impact',
    ])
  })

  // A CVSS vector string has no severity component: the qualitative rating is
  // derived from the score, not carried in the vector. Putting the category in
  // a vector-shaped format would emit a bare word such as `Critical` into the
  // middle of a `CVSS:4.0/...` string.
  it('keeps the qualitative severity rating out of the vector-shaped formats', () => {
    const vectors = vectorFormats()
    // Require actual vector formats and fields so the severity assertion
    // cannot pass vacuously on an empty projection.
    expect(vectors.length).toBeGreaterThan(0)
    for (const format of vectors) {
      const written = ((format.fields ?? []) as Array<{ category?: string }>).map(
        (field) => field.category,
      )
      expect(written.length, `${format.id} writes no field`).toBeGreaterThan(0)
      expect({ format: format.id, carriesSeverity: false }).toEqual({
        format: format.id,
        carriesSeverity: written.includes('severity'),
      })
    }
  })

  // The rating still has to be renderable: an analyst who wants `Critical` on
  // a report should not have to read it out of the document themselves. It
  // gets a format of its own, carrying that one category and nothing else.
  it('renders the qualitative severity rating through a format of its own', () => {
    const severity = (cvssV4.scheme.render?.formats ?? []).find(
      (format) => format.id === 'severity',
    )
    expect(severity).toBeDefined()
    // The ordered fields declare the categories this format writes.
    expect(
      ((severity?.fields ?? []) as Array<{ category?: string }>).map((field) => field.category),
    ).toEqual(['severity'])
    expect(severity?.view).toBe('default')
  })

  it('judges a qualitative rating independently from a complete vector', () => {
    expect(cvssV4.category('severity')?.scopes).toEqual(['severity'])
    for (const category of cvssV4.scheme.data.categories) {
      if (category.id === 'severity') continue
      expect(category.scopes).toBeUndefined()
    }
    expect(cvssV4.scheme.render?.formats?.find((format) => format.id === 'severity')?.surface).toBe(
      'severity',
    )
  })

  it('declares the Threat and Supplemental categories', () => {
    expect(cvssV4.categoryIds).toEqual(
      expect.arrayContaining([
        'exploit_maturity',
        'safety',
        'automatable',
        'recovery',
        'value_density',
        'response_effort',
        'provider_urgency',
      ]),
    )
  })

  // Automatable is a quantifier trap. FIRST scores AU:N when the attacker
  // cannot automate all four kill-chain steps, which means at least one step
  // resists automation, not that none of them can be automated. The negation
  // belongs on the verb, and a mirror-image pair of sentences is exactly how
  // it slides onto the subject instead. Consumers copy these strings into
  // their own UIs, so pin both sides of the pair.
  it('states the Automatable pair without inverting the quantifier', () => {
    const automatable = cvssV4.conceptsIn('automatable').map((concept) => ({
      id: concept.id,
      definition: concept.definition,
    }))
    expect(automatable).toEqual([
      {
        id: 'AU_X',
        definition:
          'This Supplemental metric has not been evaluated and does not affect the CVSS score.',
      },
      {
        id: 'AU_N',
        definition:
          'The attacker cannot reliably automate every stage of the kill chain, from reconnaissance through exploitation, for this vulnerability.',
      },
      {
        id: 'AU_Y',
        definition:
          'Every stage of the kill chain, from reconnaissance through exploitation, can be automated reliably for this vulnerability.',
      },
    ])
  })

  it('declares the Environmental group: Security Requirements and Modified Base metrics', () => {
    expect(cvssV4.categoryIds).toEqual(
      expect.arrayContaining([
        // Security Requirements
        'confidentiality_requirement',
        'integrity_requirement',
        'availability_requirement',
        // Modified Base metrics
        'modified_attack_vector',
        'modified_attack_complexity',
        'modified_attack_requirements',
        'modified_privileges_required',
        'modified_user_interaction',
        'modified_vc_impact',
        'modified_vi_impact',
        'modified_va_impact',
        'modified_sc_impact',
        'modified_si_impact',
        'modified_sa_impact',
      ]),
    )
  })

  // FIRST allows Safety only on Modified Subsequent Integrity and Availability.
  // MSC:S is not a value in the specification, and authoring it would let a
  // scorer record a safety impact on confidentiality, which means nothing.
  it('exposes the Safety (S) special value only on MSI and MSA, never MSC', () => {
    expect(categoryHasMetricValue('modified_si_impact', 'S')).toBe(true)
    expect(categoryHasMetricValue('modified_sa_impact', 'S')).toBe(true)
    expect(categoryHasMetricValue('modified_sc_impact', 'S')).toBe(false)
  })

  // Counts are exact so a dropped or duplicated metric fails here rather than
  // slipping through a loose bound.
  it('declares 33 metric categories and 120 metric values', () => {
    expect(cvssV4.scheme.data.categories).toHaveLength(33)
    expect(cvssV4.concepts).toHaveLength(120)
  })

  it('declares the five qualitative severity ratings', () => {
    expect(cvssV4.conceptsIn('severity').map((concept) => concept.id)).toEqual([
      'SEV_CRITICAL',
      'SEV_HIGH',
      'SEV_MEDIUM',
      'SEV_LOW',
      'SEV_NONE',
    ])
  })

  // The v3.1 sibling records an explained case correction for lowercase
  // metric values. v4.0 parses lowercase either way, since the scheme is not
  // case sensitive, but without this rule it silently accepts what the sibling
  // reports. Two schemes for the same standard should not differ there.
  it('records a case correction for lowercase metric values', () => {
    const normalize = (cvssV4.scheme.parse?.normalize ?? []) as Array<Record<string, unknown>>
    const fixCase = normalize.find((rule) => rule.id === 'fix-case')
    expect(fixCase).toBeDefined()
    expect(fixCase?.correction).toBe('upper')
    const pattern = new RegExp(String(fixCase?.pattern))
    expect(pattern.test('av:n')).toBe(true)
    expect(pattern.test('msi:s')).toBe(true)
  })

  // Every metric in every group takes exactly one value in the FIRST v4.0
  // specification. `single: true` is how the document says so; the engine's
  // exclusivity errors are downstream of this declaration.
  it('declares every metric category as single-pick', () => {
    const repeatable = cvssV4.scheme.data.categories
      .filter((category) => category.single !== true)
      .map((category) => category.id)
    expect(repeatable).toEqual([])
  })
})
