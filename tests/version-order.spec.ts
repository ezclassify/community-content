/**
 * Version ordering for the folder tooling.
 *
 * `compareVersions` decides which version of a scheme the manifest calls
 * latest, and whether a CLI pin's tested version clears its declared minimum.
 * The prerelease rule is the one that is easy to get wrong: a release candidate
 * must sort below the release it leads to, or a pin naming 1.0.0 would accept
 * 1.0.0-rc.1.
 *
 * The comparator is plain ESM with JSDoc, like the rest of `scripts/`, so it is
 * exercised through node the way the other tooling specs run their scripts.
 */
import { execFileSync } from 'node:child_process'
import * as path from 'node:path'

const repoRoot = path.resolve(__dirname, '..')

/**
 * Run one call against the real module and return what it produced.
 *
 * @param expression - Expression over the imported `lib` namespace.
 */
function evaluate(expression: string): unknown {
  const source = `import * as lib from './scripts/lib/scheme-folder.mjs';process.stdout.write(JSON.stringify(${expression}))`
  return JSON.parse(
    execFileSync('node', ['--input-type=module', '-e', source], {
      cwd: repoRoot,
      encoding: 'utf-8',
    }),
  )
}

/** Sign of a comparison, so the assertions read as order rather than deltas. */
function order(a: string, b: string): number {
  return evaluate(
    `Math.sign(lib.compareVersions(${JSON.stringify(a)}, ${JSON.stringify(b)}))`,
  ) as number
}

describe('compareVersions', () => {
  it('orders by major, minor, then patch', () => {
    expect(order('1.0.0', '2.0.0')).toBe(-1)
    expect(order('1.2.0', '1.10.0')).toBe(-1)
    expect(order('1.0.2', '1.0.10')).toBe(-1)
    expect(order('3.1.0', '3.1.0')).toBe(0)
  })

  it('sorts a prerelease below the release it leads to', () => {
    expect(order('1.0.0-rc.1', '1.0.0')).toBe(-1)
    expect(order('1.0.0-dev.0', '1.0.0-rc.1')).toBe(-1)
    expect(order('1.0.0-rc.2', '1.0.0-rc.10')).toBe(-1)
  })

  it('ignores build metadata', () => {
    expect(order('1.0.0+build.1', '1.0.0+build.2')).toBe(0)
  })

  // A scheme version is authored text, so a malformed one has to order somehow
  // rather than throw before the validator can report it.
  it('falls back to lexicographic order when a version is not semver', () => {
    expect(order('not-a-version', 'zzz')).toBe(-1)
    expect(order('1.0', '1.0')).toBe(0)
  })

  it('reads the highest version out of a list', () => {
    expect(evaluate("lib.highestVersion(['1.0.0', '20161231.0.0', '2.5.1'])")).toBe('20161231.0.0')
    expect(evaluate("lib.highestVersion(['1.0.0-rc.1', '1.0.0'])")).toBe('1.0.0')
  })
})
