/**
 * The Cedar Valley teaching suites state the district's rules precisely.
 *
 * `npm run validate` proves every suite is well formed and composes only what
 * this folder holds; the CLI proves each case passes. This file pins what the
 * teaching suites must keep saying: each teaching stage tests its scheme, guide
 * and access policy, refusals name their reason, and access denials cover the
 * claims a user is missing rather than only the grants.
 */
import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { parseDocument } from '@ezclassify/validator'
import type { TestSuite } from '@ezclassify/types'

const SUITES = path.resolve(__dirname, '../scheme-folder/test-suites')
const STAGES = ['cedar-valley-protection', 'cedar-valley-handling', 'cedar-valley']

const suites = fs
  .readdirSync(SUITES)
  .filter((name) => name.startsWith('cedar-valley'))
  .map((name) => (parseDocument(path.join(SUITES, name)) as { testSuite: TestSuite }).testSuite)

/** The suite with this id. */
function suite(id: string): TestSuite {
  const found = suites.find((one) => one.id === id)
  if (!found) throw new Error(`no suite ${id}`)
  return found
}

/** The assertions of one case. */
function checks(suiteId: string, caseId: string) {
  const found = suite(suiteId).cases.find((test) => test.id === caseId)
  if (!found) throw new Error(`no case ${caseId} in ${suiteId}`)
  return found.assertions
}

describe('Cedar Valley teaching suites', () => {
  it('test the scheme, guide and access policy of every teaching stage at 1.0.0', () => {
    expect(suites.map((one) => one.id).sort()).toEqual(
      STAGES.flatMap((stage) => [
        `${stage}-tests`,
        `${stage}-guide-tests`,
        `${stage}-access-tests`,
      ]).sort(),
    )
    for (const stage of STAGES) {
      const ref = (id: string) => ({ id, version: '1.0.0' })
      expect(suite(`${stage}-tests`).composition).toEqual({ scheme: ref(stage) })
      expect(suite(`${stage}-guide-tests`).composition).toEqual({
        scheme: ref(stage),
        guides: [ref(`${stage}-guide`)],
      })
      expect(suite(`${stage}-access-tests`).composition).toEqual({
        scheme: ref(stage),
        access: ref(`${stage}-access`),
      })
    }
  })

  it('name every case plainly and never repeat one', () => {
    for (const one of suites) {
      for (const test of one.cases) expect(test.name?.trim().length).toBeGreaterThan(0)
      const ids = one.cases.map((test) => test.id)
      expect(new Set(ids).size).toBe(ids.length)
      const signatures = one.cases.map((test) =>
        JSON.stringify([test.operation, test.input, test.options, test.assertions]),
      )
      expect(new Set(signatures).size).toBe(signatures.length)
    }
  })

  it('deny access for a missing school or content permission, not only grant it', () => {
    for (const id of ['every-content-permission-required', 'unpermitted-school-refused']) {
      expect(checks('cedar-valley-access-tests', id)).toEqual([
        { path: ['result', 'granted'], matcher: 'equals', value: false },
      ])
    }
  })

  it('refuse hidden extra school recipients even when the rendered marking looks right', () => {
    for (const id of [
      'blank-school-scope-is-neutral',
      'school-intersection-does-not-add-recipients',
    ]) {
      const assertions = checks('cedar-valley-tests', id)
      expect(assertions).toContainEqual({
        path: ['rendered'],
        matcher: 'equals',
        value: 'CONFIDENTIAL//OAKWOOD',
      })
      expect(assertions).toContainEqual({
        path: ['assertions'],
        matcher: 'contains',
        value: { categoryId: 'permitted_schools', conceptId: 'OAKWOOD' },
      })
      for (const conceptId of ['PINECREST', 'RIVERSIDE', 'ALL'])
        expect(assertions).toContainEqual({
          path: ['assertions'],
          matcher: 'excludes',
          value: { categoryId: 'permitted_schools', conceptId },
        })
    }
  })

  it('require the stated refusal reason instead of accepting any invalid outcome', () => {
    expect(checks('cedar-valley-tests', 'disjoint-schools-do-not-broaden-access')).toContainEqual({
      path: ['errors'],
      matcher: 'contains',
      value: { constraintId: 'school-intersection-must-not-empty' },
    })
    for (const [id, constraintId] of [
      ['financial-information-has-confidential-floor', 'financial-information-is-confidential'],
      ['floor-refused-security-information-is-restricted', 'security-information-is-restricted'],
    ]) {
      const assertions = checks('cedar-valley-tests', id)
      expect(assertions).toContainEqual({
        path: ['errors', '0', 'constraintId'],
        matcher: 'equals',
        value: constraintId,
      })
      expect(assertions).toContainEqual({ path: ['errors', '1'], matcher: 'absent' })
    }
  })
})
