/**
 * Document contract for the CVSS v3.1 scheme.
 *
 * These assertions read the vocabulary and the rule set straight from the
 * authored YAML. Vector-string round-trip and aggregation are engine behavior,
 * stated in the test suite `scheme-folder/test-suites/cvss-tests@1.0.0.yaml`,
 * which the EzClassify CLI runs.
 */
import {
  schemeDocument,
  itSatisfiesTheSchemeContract,
} from '../../../../tests/helpers/scheme-document'

const cvss = schemeDocument('schemes/cvss@3.1.0.yaml')

describe('CVSS v3.1 scheme document', () => {
  itSatisfiesTheSchemeContract(cvss)

  it('is the CVSS v3.1 scheme', () => {
    expect(cvss.scheme.id).toBe('cvss')
    expect(cvss.scheme.version).toBe('3.1.0')
    expect(cvss.scheme.name).toBe('CVSS v3.1')
  })

  it('declares the Base metric categories', () => {
    expect(cvss.categoryIds).toEqual(
      expect.arrayContaining([
        'attack_vector',
        'attack_complexity',
        'privileges_required',
        'user_interaction',
        'scope',
        'confidentiality',
        'integrity',
        'availability',
      ]),
    )
  })

  it('declares the Temporal and Environmental categories', () => {
    expect(cvss.categoryIds).toEqual(
      expect.arrayContaining([
        'exploit_code_maturity',
        'remediation_level',
        'report_confidence',
        'confidentiality_requirement',
        'integrity_requirement',
        'availability_requirement',
      ]),
    )
  })

  it('declares 14 metric categories and 48 metric values', () => {
    expect(cvss.scheme.data.categories).toHaveLength(14)
    expect(cvss.concepts).toHaveLength(48)
  })

  it('declares every metric category as single-pick and max-rollup', () => {
    for (const category of cvss.scheme.data.categories) {
      expect({ id: category.id, single: category.single, rollup: category.rollup }).toEqual({
        id: category.id,
        single: true,
        rollup: 'max',
      })
    }
  })

  // One exclusivity rule per metric. A metric that loses its rule silently
  // starts accepting two values at once, which only an engine test would catch
  // at evaluation time. Pin the count and the coverage here instead.
  it('gives every metric category its own exclusivity rule', () => {
    const exclusive = (cvss.scheme.rules ?? []).filter((rule) => rule.action === 'exclusive')
    expect(exclusive).toHaveLength(cvss.scheme.data.categories.length)

    const ruled = new Set(exclusive.flatMap((rule) => rule.target ?? []))
    for (const concept of cvss.concepts) {
      expect({ concept: concept.id, ruled: ruled.has(concept.id) }).toEqual({
        concept: concept.id,
        ruled: true,
      })
    }
  })

  it('declares one render format, the canonical vector, and renders it by default', () => {
    expect((cvss.scheme.render?.formats ?? []).map((format) => format.id)).toEqual(['vector'])
    expect(cvss.scheme.render?.default).toBe('vector')
  })
})
