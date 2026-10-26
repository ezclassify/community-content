/**
 * Public package export surface: one YAML string per scheme.
 *
 * A consumer who only has the published npm package (no cloned scheme-folder)
 * reaches every scheme's authored source this way, so the exported string must
 * be byte-identical to the file in this repository.
 */
import * as fs from 'fs'
import * as path from 'path'
import { tlpSchemeYaml } from '../src/tlp/index.js'
import { cvssSchemeYaml } from '../src/cvss/index.js'
import { cvssV4SchemeYaml } from '../src/cvss-v4/index.js'
import { cedarValleySchemeYaml } from '../src/cedar-valley/index.js'
import { cedarValleyProtectionSchemeYaml } from '../src/cedar-valley-protection/index.js'
import { cedarValleyHandlingSchemeYaml } from '../src/cedar-valley-handling/index.js'
import * as barrel from '../src/index.js'

const schemesDir = path.resolve(__dirname, '../scheme-folder/schemes')

describe('package YAML string exports', () => {
  it.each([
    ['cedarValleySchemeYaml', cedarValleySchemeYaml, 'cedar-valley@1.0.0.yaml'],
    [
      'cedarValleyProtectionSchemeYaml',
      cedarValleyProtectionSchemeYaml,
      'cedar-valley-protection@1.0.0.yaml',
    ],
    [
      'cedarValleyHandlingSchemeYaml',
      cedarValleyHandlingSchemeYaml,
      'cedar-valley-handling@1.0.0.yaml',
    ],
    ['tlpSchemeYaml', tlpSchemeYaml, 'tlp@2.0.0.yaml'],
    ['cvssSchemeYaml', cvssSchemeYaml, 'cvss@3.1.0.yaml'],
    ['cvssV4SchemeYaml', cvssV4SchemeYaml, 'cvss-v4@4.0.0.yaml'],
  ])('%s is byte-identical to the authored source file', (_name, exported, sourceFile) => {
    expect(exported).toBe(fs.readFileSync(path.join(schemesDir, sourceFile), 'utf-8'))
  })

  it('the barrel module re-exports every scheme subpath', () => {
    expect(barrel.tlpSchemeYaml).toBe(tlpSchemeYaml)
    expect(barrel.cvssSchemeYaml).toBe(cvssSchemeYaml)
    expect(barrel.cvssV4SchemeYaml).toBe(cvssV4SchemeYaml)
  })

  it('exports scheme documents and nothing that needs an engine', () => {
    expect(Object.keys(barrel).sort()).toEqual([
      'cedarValleyHandlingSchemeYaml',
      'cedarValleyProtectionSchemeYaml',
      'cedarValleySchemeYaml',
      'cvssSchemeYaml',
      'cvssV4SchemeYaml',
      'tlpSchemeYaml',
    ])
  })
})
