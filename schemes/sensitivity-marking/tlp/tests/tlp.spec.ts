/**
 * Document contract for the FIRST Traffic Light Protocol v2.0 scheme.
 *
 * The color and definition tests below read the authored YAML rather than
 * asking an engine: what they pin is the wording and the source citation this
 * repository publishes for each label.
 *
 * Roundtrip, aggregation, and suggestion behavior are engine semantics and
 * cannot be evaluated in a public content repository. They are stated instead
 * in the test suite `scheme-folder/test-suites/tlp-tests@1.0.0.yaml`, which
 * the EzClassify CLI runs.
 */
import {
  schemeDocument,
  itSatisfiesTheSchemeContract,
} from '../../../../tests/helpers/scheme-document'

const tlp = schemeDocument('schemes/tlp@2.0.0.yaml')

describe('TLP scheme document', () => {
  itSatisfiesTheSchemeContract(tlp)

  it('is the TLP v2.0 scheme', () => {
    expect(tlp.scheme.id).toBe('tlp')
    expect(tlp.scheme.version).toBe('2.0.0')
    expect(tlp.scheme.name).toBe('Traffic Light Protocol')
  })

  it('declares one single-pick level category holding the five TLP labels', () => {
    expect(tlp.categoryIds).toEqual(['tlp_level'])
    expect(tlp.category('tlp_level')?.single).toBe(true)
    expect(tlp.category('tlp_level')?.rollup).toBe('max')
    expect(tlp.defaultViewsIn('tlp_level')).toEqual([
      'TLP:RED',
      'TLP:AMBER+STRICT',
      'TLP:AMBER',
      'TLP:GREEN',
      'TLP:CLEAR',
    ])
  })

  // A TLP marking is one label. The document says so twice: `single: true` on
  // the category, and an exclusivity rule over the vocabulary. Both have to
  // keep naming the same five concepts.
  it('makes the five levels mutually exclusive', () => {
    const exclusive = tlp.rule('exclusive-tlp')
    expect(exclusive?.action).toBe('exclusive')
    expect([...(exclusive?.target ?? [])].sort()).toEqual(
      tlp
        .conceptsIn('tlp_level')
        .map((concept) => concept.id)
        .sort(),
    )
  })

  it('ranks the levels from RED down to CLEAR', () => {
    const ranks = tlp.conceptsIn('tlp_level').map((concept) => [concept.id, concept.rank])
    expect(ranks).toEqual([
      ['TLP_RED', 4],
      ['TLP_AMBER_STRICT', 3],
      ['TLP_AMBER', 2],
      ['TLP_GREEN', 1],
      ['TLP_CLEAR', 0],
    ])
  })

  it('carries the official label colors as scheme data', () => {
    expect(tlp.scheme.render?.color_from).toBe('tlp_level')
    expect(tlp.concepts.map((concept) => [concept.id, concept.color])).toEqual(
      expect.arrayContaining([
        ['TLP_RED', { background: '#000000', text: '#ff2b2b' }],
        ['TLP_GREEN', { background: '#000000', text: '#33ff00' }],
        ['TLP_CLEAR', { background: '#000000', text: '#ffffff' }],
      ]),
    )
  })

  // The definitions are ours, written from the FIRST TLP v2.0 standard rather
  // than copied out of it, and every concept carries a `citation` pointing at
  // the section it was read from. TLP:RED must keep the v2.0 wording, not
  // v1.0's, and TLP:AMBER must keep its client boundary. Consumers copy these
  // strings into their own UIs, so pin the sharing boundary each one states
  // and keep the citation with it.
  it('states each sharing boundary in our own words, with a citation', () => {
    const sourced = tlp.concepts.map((concept) => ({
      id: concept.id,
      definition: concept.definition,
      citation: concept.citation,
    }))
    expect(sourced).toEqual([
      {
        id: 'TLP_RED',
        definition:
          'The recipient may not pass the material on. It stops with the people who received it directly.',
        citation:
          'FIRST Traffic Light Protocol v2.0, TLP Definitions (TLP:RED), https://www.first.org/tlp/',
      },
      {
        id: 'TLP_AMBER_STRICT',
        definition:
          'The recipient may share within its own organization on a need-to-know basis, and no further.',
        citation:
          'FIRST Traffic Light Protocol v2.0, TLP Definitions (TLP:AMBER+STRICT), https://www.first.org/tlp/',
      },
      {
        id: 'TLP_AMBER',
        definition:
          "The recipient may share within its own organization and with that organization's clients, on a need-to-know basis.",
        citation:
          'FIRST Traffic Light Protocol v2.0, TLP Definitions (TLP:AMBER), https://www.first.org/tlp/',
      },
      {
        id: 'TLP_GREEN',
        definition:
          'The recipient may share with peers and partner organizations in its community, but not publicly.',
        citation:
          'FIRST Traffic Light Protocol v2.0, TLP Definitions (TLP:GREEN), https://www.first.org/tlp/',
      },
      {
        id: 'TLP_CLEAR',
        definition:
          'The recipient may share the material with anyone. There is no limit on disclosure.',
        citation:
          'FIRST Traffic Light Protocol v2.0, TLP Definitions (TLP:CLEAR), https://www.first.org/tlp/',
      },
    ])
  })

  it('declares the short render format the UI shorthand relies on', () => {
    const formats = (tlp.scheme.render?.formats ?? []).map((format) => format.id)
    expect(formats).toEqual(['default', 'short'])
    expect(tlp.scheme.render?.default).toBe('default')
  })
})
