/**
 * The three folder commands, and the two lanes they feed.
 *
 * `validate`, `fmt`, and `build` are the commands CONTRIBUTING tells a
 * contributor to run, so this file proves they run on a clean clone and that
 * each one can actually fail. A validator that cannot go red is a validator
 * that proves nothing.
 *
 * Mutation cases copy the scheme folder into an OS temp dir. Nothing here
 * writes to the checked-in tree except `fmt`, which is asserted to be a no-op.
 */
import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

const repoRoot = path.resolve(__dirname, '..')
const folder = path.join(repoRoot, 'scheme-folder')

interface Run {
  code: number
  out: string
  err: string
}

/** Run a repository script and capture its outcome rather than throwing. */
function run(script: string, args: string[] = [], cwd = repoRoot): Run {
  try {
    const out = execFileSync('node', [script, ...args], {
      cwd,
      encoding: 'utf-8',
      stdio: 'pipe',
    })
    return { code: 0, out, err: '' }
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string }
    return { code: err.status ?? 1, out: err.stdout ?? '', err: err.stderr ?? '' }
  }
}

const temps: string[] = []

afterEach(() => {
  while (temps.length > 0) fs.rmSync(temps.pop() as string, { recursive: true, force: true })
})

/**
 * Copy the whole repository's scripts plus a mutable copy of the scheme folder
 * into a temp root, so a validation run can be pointed at a broken folder
 * without touching the real one.
 */
function repoWithMutableFolder(): string {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'community-content-'))
  temps.push(dest)
  fs.cpSync(path.join(repoRoot, 'scripts'), path.join(dest, 'scripts'), { recursive: true })
  fs.cpSync(folder, path.join(dest, 'scheme-folder'), { recursive: true })
  // Symlinked, not copied: the scripts only read from it, and copying a full
  // dependency tree per case turns a fast unit test into a slow one.
  fs.symlinkSync(path.join(repoRoot, 'node_modules'), path.join(dest, 'node_modules'), 'dir')
  fs.copyFileSync(path.join(repoRoot, 'package.json'), path.join(dest, 'package.json'))
  fs.copyFileSync(
    path.join(repoRoot, 'ezclassify-cli.json'),
    path.join(dest, 'ezclassify-cli.json'),
  )
  return dest
}

describe('npm run validate', () => {
  it('passes on the committed folder and reports the suites it checked', () => {
    const result = run('scripts/validate-folder.mjs')
    expect(result.code).toBe(0)
    expect(result.out).toContain('is valid')
    expect(result.out).toMatch(/\d+ test suites/)
  })

  it('fails when the manifest disagrees with disk', () => {
    const root = repoWithMutableFolder()
    fs.rmSync(path.join(root, 'scheme-folder', 'schemes', 'tlp@2.0.0.yaml'))
    const result = run('scripts/validate-folder.mjs', [], root)
    expect(result.code).toBe(1)
    expect(result.err).toContain('manifest_extra_entry')
  })

  it('fails when a suite composes a version this folder does not hold', () => {
    const root = repoWithMutableFolder()
    const suite = path.join(root, 'scheme-folder', 'test-suites', 'tlp-tests@1.0.0.yaml')
    fs.writeFileSync(
      suite,
      fs.readFileSync(suite, 'utf-8').replace('      version: 2.0.0', '      version: 9.9.9'),
    )
    const result = run('scripts/validate-folder.mjs', [], root)
    expect(result.code).toBe(1)
    expect(result.err).toContain('composition.scheme names scheme "tlp@9.9.9"')
  })

  it('fails when a suite does not satisfy the published suite schema', () => {
    const root = repoWithMutableFolder()
    const suite = path.join(root, 'scheme-folder', 'test-suites', 'tlp-tests@1.0.0.yaml')
    fs.writeFileSync(
      suite,
      fs.readFileSync(suite, 'utf-8').replace('      operation: render\n', ''),
    )
    const result = run('scripts/validate-folder.mjs', [], root)
    expect(result.code).toBe(1)
    expect(result.err).toContain('suite_schema_invalid')
  })

  it('fails when a suite file is not named for the suite it holds', () => {
    const root = repoWithMutableFolder()
    const dir = path.join(root, 'scheme-folder', 'test-suites')
    fs.renameSync(path.join(dir, 'tlp-tests@1.0.0.yaml'), path.join(dir, 'tlp-tests@2.0.0.yaml'))
    const result = run('scripts/validate-folder.mjs', [], root)
    expect(result.code).toBe(1)
    expect(result.err).toContain('suite_filename_mismatch')
  })

  it('fails when a published scheme has no test suite', () => {
    const root = repoWithMutableFolder()
    fs.rmSync(path.join(root, 'scheme-folder', 'test-suites', 'tlp-tests@1.0.0.yaml'))
    const result = run('scripts/validate-folder.mjs', [], root)
    expect(result.code).toBe(1)
    expect(result.err).toContain('scheme "tlp@2.0.0" has no test suite')
  })
})

describe('npm run fmt', () => {
  it('is a no-op on the committed manifest', () => {
    const before = fs.readFileSync(path.join(folder, 'scheme-folder.yaml'), 'utf-8')
    expect(run('scripts/fmt-folder.mjs').code).toBe(0)
    expect(fs.readFileSync(path.join(folder, 'scheme-folder.yaml'), 'utf-8')).toBe(before)
  })

  it('renames a misnamed definition and reindexes the manifest', () => {
    const root = repoWithMutableFolder()
    const schemes = path.join(root, 'scheme-folder', 'schemes')
    fs.renameSync(path.join(schemes, 'tlp@2.0.0.yaml'), path.join(schemes, 'misnamed.yaml'))

    expect(run('scripts/fmt-folder.mjs', [], root).code).toBe(0)

    expect(fs.existsSync(path.join(schemes, 'tlp@2.0.0.yaml'))).toBe(true)
    expect(fs.existsSync(path.join(schemes, 'misnamed.yaml'))).toBe(false)
    expect(run('scripts/validate-folder.mjs', [], root).code).toBe(0)
  })
})

describe('npm run build', () => {
  it('compiles exactly the folder suites, replacing anything stale', () => {
    const root = repoWithMutableFolder()
    const output = path.join(root, 'dist', 'test-suites')
    fs.mkdirSync(output, { recursive: true })
    fs.writeFileSync(path.join(output, 'unlisted-old-tests@1.0.0.json'), '{}')
    expect(run('scripts/bundle-test-suites.mjs', [], root).code).toBe(0)
    const index = JSON.parse(fs.readFileSync(path.join(output, 'index.json'), 'utf8')) as {
      testSuites: Array<{
        id: string
        version: string
        filename: string
        testPolicy: { kind: string; id: string; version: string }
      }>
    }
    const authored = fs
      .readdirSync(path.join(root, 'scheme-folder', 'test-suites'))
      .map((name) => name.replace(/\.yaml$/, '.json'))
      .sort()
    expect(index.testSuites.map((suite) => suite.filename).sort()).toEqual(authored)
    expect(fs.readdirSync(output).sort()).toEqual(['index.json', ...authored].sort())
    expect(index.testSuites.find((suite) => suite.id === 'cedar-valley-access-tests')).toEqual({
      id: 'cedar-valley-access-tests',
      version: '1.0.2',
      testPolicy: { kind: 'access', id: 'cedar-valley-access', version: '1.0.0' },
      filename: 'cedar-valley-access-tests@1.0.2.json',
    })
    expect(index.testSuites.find((suite) => suite.id === 'tlp-tests')?.testPolicy).toEqual({
      kind: 'scheme',
      id: 'tlp',
      version: '2.0.0',
    })
    const compiled = JSON.parse(
      fs.readFileSync(path.join(output, 'tlp-tests@1.0.0.json'), 'utf8'),
    ) as { testSuite: { id: string; cases: unknown[] } }
    expect(Object.keys(compiled)).toEqual(['testSuite'])
    expect(compiled.testSuite.cases.length).toBeGreaterThan(0)
  })

  it('refuses to compile an invalid suite', () => {
    const root = repoWithMutableFolder()
    const dir = path.join(root, 'scheme-folder', 'test-suites')
    fs.renameSync(path.join(dir, 'tlp-tests@1.0.0.yaml'), path.join(dir, 'tlp-tests@2.0.0.yaml'))
    const result = run('scripts/bundle-test-suites.mjs', [], root)
    expect(result.code).toBe(1)
    expect(result.err).toContain('refusing to build from invalid suites')
    expect(fs.existsSync(path.join(root, 'dist', 'test-suites'))).toBe(false)
  })

  it('emits one wrapped JSON per scheme plus the context index', () => {
    const root = repoWithMutableFolder()
    expect(run('scripts/bundle-schemes.mjs', [], root).code).toBe(0)

    const outDir = path.join(root, 'dist', 'schemes')
    expect(fs.readdirSync(outDir).sort()).toEqual([
      'cedar-valley-access@1.0.0.access.json',
      'cedar-valley-guide@1.0.0.guide.json',
      'cedar-valley-handling-access@1.0.0.access.json',
      'cedar-valley-handling-guide@1.0.0.guide.json',
      'cedar-valley-handling@1.0.0.json',
      'cedar-valley-protection-access@1.0.0.access.json',
      'cedar-valley-protection-guide@1.0.0.guide.json',
      'cedar-valley-protection@1.0.0.json',
      'cedar-valley@1.0.0.json',
      'contexts.json',
      'cvss-v4@4.0.0.json',
      'cvss@3.1.0.json',
      'tlp@2.0.0.json',
    ])

    const tlp = JSON.parse(fs.readFileSync(path.join(outDir, 'tlp@2.0.0.json'), 'utf-8'))
    expect(Object.keys(tlp)).toEqual(['scheme'])
    expect(tlp.scheme.id).toBe('tlp')

    const contexts = JSON.parse(fs.readFileSync(path.join(outDir, 'contexts.json'), 'utf-8'))
    expect(
      contexts.contexts.map(
        (context: { id: string; version: string }) => `${context.id}@${context.version}`,
      ),
    ).toEqual([
      'cedar-valley-handling@1.0.0',
      'cedar-valley-protection@1.0.0',
      'cedar-valley@1.0.0',
      'cedar-valley-handling@latest',
      'cedar-valley-protection@latest',
      'cedar-valley@latest',
    ])
    expect(
      contexts.contexts.find((context: { id: string }) => context.id === 'cedar-valley').scheme,
    ).toEqual({ id: 'cedar-valley', version: '1.0.0' })
    for (const id of ['cedar-valley-handling', 'cedar-valley-protection', 'cedar-valley']) {
      expect(
        contexts.contexts
          .filter((context: { id: string }) => context.id === id)
          .map((context: { scheme: { id: string; version: string } }) => context.scheme),
      ).toEqual([
        { id, version: '1.0.0' },
        { id, version: '1.0.0' },
      ])
    }
  })

  it('refuses to write a dist from an invalid document', () => {
    const root = repoWithMutableFolder()
    const scheme = path.join(root, 'scheme-folder', 'schemes', 'tlp@2.0.0.yaml')
    fs.writeFileSync(
      scheme,
      fs.readFileSync(scheme, 'utf-8').replace('  version: 2.0.0', '  version: []'),
    )
    const result = run('scripts/bundle-schemes.mjs', [], root)
    expect(result.code).toBe(1)
    expect(result.err).toContain('refusing to build an invalid folder')
    expect(fs.existsSync(path.join(root, 'dist', 'schemes'))).toBe(false)
  })

  it('refuses a definition that is not wrapped in its kind envelope', () => {
    const root = repoWithMutableFolder()
    const scheme = path.join(root, 'scheme-folder', 'schemes', 'tlp@2.0.0.yaml')
    // Drop the `scheme:` line and dedent its body so the file is bare.
    const bare = fs
      .readFileSync(scheme, 'utf-8')
      .split('\n')
      .slice(1)
      .map((line) => line.replace(/^ {4}/, ''))
      .join('\n')
    fs.writeFileSync(scheme, bare)

    for (const script of ['scripts/bundle-schemes.mjs', 'scripts/fmt-folder.mjs']) {
      const result = run(script, [], root)
      expect(result.code).not.toBe(0)
      expect(result.err).toContain('must be wrapped in a top-level `scheme:` key')
    }
    expect(fs.existsSync(path.join(root, 'dist', 'schemes'))).toBe(false)
  })
})

describe('the behavioral lane', () => {
  it('fails when no CLI is available', () => {
    const root = repoWithMutableFolder()
    const result = run('scripts/behavioral-suites.mjs', [], root)
    expect(result.code).toBe(1)
    expect(result.err).toContain('required lane cannot run')
  })
})

describe('the CLI pin', () => {
  it('accepts the committed pin', () => {
    expect(run('scripts/check-cli-pin.mjs').code).toBe(0)
  })

  it('refuses a download source with no checksum', () => {
    const root = repoWithMutableFolder()
    fs.writeFileSync(
      path.join(root, 'ezclassify-cli.json'),
      JSON.stringify({
        minimumVersion: '1.0.0',
        testedVersion: '1.0.0',
        archive: { url: 'https://example.invalid/cli.tar.gz', sha256: null },
      }),
    )
    const result = run('scripts/check-cli-pin.mjs', [], root)
    expect(result.code).toBe(1)
    expect(result.err).toContain('archive.sha256')
  })

  it('refuses a tested version below the minimum', () => {
    const root = repoWithMutableFolder()
    fs.writeFileSync(
      path.join(root, 'ezclassify-cli.json'),
      JSON.stringify({ minimumVersion: '2.0.0', testedVersion: '1.0.0' }),
    )
    const result = run('scripts/check-cli-pin.mjs', [], root)
    expect(result.code).toBe(1)
    expect(result.err).toContain('below minimumVersion')
  })
})
