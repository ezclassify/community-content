/**
 * Verify CLI pin resolution and behavioral-lane failure reporting.
 *
 * A configured pin promises the suites run. An unconfigured pin resolves
 * nothing, and the explicit behavior command then requires a supplied CLI.
 * Archives and command fixtures are local, so the suite is hermetic.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const resolver = resolve(repositoryRoot, 'scripts/resolve-cli.mjs')
const pinCheck = resolve(repositoryRoot, 'scripts/check-cli-pin.mjs')
const suites = resolve(repositoryRoot, 'scripts/behavioral-suites.mjs')

interface Run {
  status: number
  output: string
}

/** A scratch directory for one test's fixtures. */
function scratch(label: string): string {
  return mkdtempSync(join(tmpdir(), `ezclassify-cli-pin-${label}-`))
}

/**
 * Run a repository script with an environment that has no EzClassify CLI in it:
 * no `EZCLASSIFY_CLI`, and a `PATH` holding only the fixtures this test wrote.
 */
function run(script: string, args: string[], env: Record<string, string> = {}): Run {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: repositoryRoot,
    encoding: 'utf-8',
    env: {
      HOME: process.env['HOME'] ?? '',
      PATH: env['PATH'] ?? '/usr/bin:/bin:/usr/sbin:/sbin',
      ...env,
    },
  })
  return { status: result.status ?? 1, output: `${result.stdout ?? ''}${result.stderr ?? ''}` }
}

/** Write a pin file and return its path. */
function pinFile(dir: string, pin: Record<string, unknown>): string {
  const path = join(dir, 'ezclassify-cli.json')
  writeFileSync(
    path,
    `${JSON.stringify({ minimumVersion: '1.0.0', testedVersion: '1.0.0', ...pin }, null, 4)}\n`,
  )
  return path
}

/**
 * Build a gzipped tar holding the given files, each `[relative path, contents]`.
 * Every entry is mode 0755 so an `ezclassify` entry comes out runnable.
 */
function tarball(dir: string, name: string, files: Array<[string, string]>): string {
  const staging = join(dir, `stage-${name}`)
  for (const [relative, contents] of files) {
    const target = join(staging, relative)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, contents)
    chmodSync(target, 0o755)
  }
  mkdirSync(staging, { recursive: true })
  const archive = join(dir, `${name}.tar.gz`)
  execFileSync('tar', ['-czf', archive, '-C', staging, '.'])
  return archive
}

/** The pin block for an archive on disk, checksummed the way the real pin is. */
function archivePin(archive: string, sha256?: string): Record<string, unknown> {
  return {
    archive: {
      url: pathToFileURL(archive).toString(),
      sha256: sha256 ?? createHash('sha256').update(readFileSync(archive)).digest('hex'),
    },
  }
}

/** A CLI stub that answers `--version` and any suite invocation. */
const WORKING_CLI = '#!/bin/sh\nif [ "$1" = "--version" ]; then echo 1.0.0; exit 0; fi\nexit 0\n'

/** A CLI stub that is present but broken, the way a bad build would be. */
const BROKEN_CLI = '#!/bin/sh\necho "boom" >&2\nexit 3\n'

/**
 * Write a fake container engine and return the PATH that finds it. The script
 * answers `--version`, then dispatches on the first argument using the
 * behaviors given: `pull`, `inspect`, and `run` each get an exit code and the
 * text to print on stdout.
 */
function containerEngine(
  dir: string,
  behaviors: { pull?: [number, string]; inspect?: [number, string]; run?: [number, string] },
): { path: string; engine: string } {
  const bin = join(dir, 'bin')
  mkdirSync(bin, { recursive: true })
  const engine = join(bin, 'fake-engine')
  const [pullStatus, pullOut] = behaviors.pull ?? [0, '']
  const [inspectStatus, inspectOut] = behaviors.inspect ?? [0, '']
  const [runStatus, runOut] = behaviors.run ?? [0, '']
  writeFileSync(
    engine,
    [
      '#!/bin/sh',
      'case "$1" in',
      `  --version) echo "fake-engine 1.0"; exit 0 ;;`,
      `  pull) echo '${pullOut}'; exit ${pullStatus} ;;`,
      `  image) echo '${inspectOut}'; exit ${inspectStatus} ;;`,
      `  run) echo '${runOut}'; exit ${runStatus} ;;`,
      'esac',
      'exit 99',
      '',
    ].join('\n'),
    { mode: 0o755 },
  )
  return { path: `${bin}:/usr/bin:/bin`, engine }
}

const DIGEST = `sha256:${'a'.repeat(64)}`

describe('a configured pin cannot skip', () => {
  it('fails when the pinned archive cannot be downloaded', () => {
    const dir = scratch('missing')
    const pin = pinFile(dir, {
      archive: {
        url: pathToFileURL(join(dir, 'absent.tar.gz')).toString(),
        sha256: 'a'.repeat(64),
      },
    })

    const result = run(resolver, ['--pin', pin, '--work-dir', join(dir, 'work')])

    expect(result.status).toBe(1)
    expect(result.output).toContain('could not be downloaded')
  })

  it('fails when the pinned archive does not match its checksum', () => {
    const dir = scratch('checksum')
    const archive = tarball(dir, 'cli', [['ezclassify', WORKING_CLI]])
    const pin = pinFile(dir, archivePin(archive, 'b'.repeat(64)))

    const result = run(resolver, ['--pin', pin, '--work-dir', join(dir, 'work')])

    expect(result.status).toBe(1)
    expect(result.output).toContain('does not match its checksum')
  })

  // An archive that unpacks to nothing must not export an empty
  // EZCLASSIFY_CLI and report a green skip.
  it('fails when the pinned archive contains no ezclassify executable', () => {
    const dir = scratch('empty')
    const archive = tarball(dir, 'cli', [['README.md', 'no binary in here\n']])
    const pin = pinFile(dir, archivePin(archive))

    const result = run(resolver, ['--pin', pin, '--work-dir', join(dir, 'work')])

    expect(result.status).toBe(1)
    expect(result.output).toContain('contains no ezclassify executable')
  })

  it('fails when the pinned archive ships an ezclassify that does not run', () => {
    const dir = scratch('broken')
    const archive = tarball(dir, 'cli', [['bin/ezclassify', BROKEN_CLI]])
    const pin = pinFile(dir, archivePin(archive))

    const result = run(resolver, ['--pin', pin, '--work-dir', join(dir, 'work')])

    expect(result.status).toBe(1)
    expect(result.output).toContain('does not run')
  })

  it('resolves a good archive to the executable it holds', () => {
    const dir = scratch('good')
    const archive = tarball(dir, 'cli', [['bin/ezclassify', WORKING_CLI]])
    const pin = pinFile(dir, archivePin(archive))

    const result = run(resolver, ['--pin', pin, '--work-dir', join(dir, 'work')])

    expect(result.status).toBe(0)
    expect(result.output).toContain('resolved the pinned CLI from the archive')
    expect(result.output).toContain(join(dir, 'work', 'archive', 'bin', 'ezclassify'))
  })
})

describe('an image pin resolves through the container engine', () => {
  it('fails when the pinned image cannot be pulled', () => {
    const dir = scratch('image-pull')
    const { path, engine } = containerEngine(dir, { pull: [1, 'manifest unknown'] })
    const pin = pinFile(dir, { image: { ref: 'ghcr.io/ezclassify/cli', digest: DIGEST } })

    const result = run(resolver, ['--pin', pin, '--work-dir', join(dir, 'work')], {
      PATH: path,
      EZCLASSIFY_CONTAINER_ENGINE: engine,
    })

    expect(result.status).toBe(1)
    expect(result.output).toContain('could not be pulled')
  })

  it('fails when the local image does not carry the pinned digest', () => {
    const dir = scratch('image-digest')
    const { path, engine } = containerEngine(dir, {
      inspect: [0, '["ghcr.io/ezclassify/cli@sha256:' + 'c'.repeat(64) + '"]'],
    })
    const pin = pinFile(dir, { image: { ref: 'ghcr.io/ezclassify/cli', digest: DIGEST } })

    const result = run(resolver, ['--pin', pin, '--work-dir', join(dir, 'work')], {
      PATH: path,
      EZCLASSIFY_CONTAINER_ENGINE: engine,
    })

    expect(result.status).toBe(1)
    expect(result.output).toContain('does not carry the pinned digest')
  })

  it('fails when the pinned image provides no runnable ezclassify', () => {
    const dir = scratch('image-noclie')
    const { path, engine } = containerEngine(dir, {
      inspect: [0, `["ghcr.io/ezclassify/cli@${DIGEST}"]`],
      run: [127, 'executable file not found'],
    })
    const pin = pinFile(dir, { image: { ref: 'ghcr.io/ezclassify/cli', digest: DIGEST } })

    const result = run(resolver, ['--pin', pin, '--work-dir', join(dir, 'work')], {
      PATH: path,
      EZCLASSIFY_CONTAINER_ENGINE: engine,
    })

    expect(result.status).toBe(1)
    expect(result.output).toContain('provides no runnable ezclassify')
  })

  it('writes a wrapper that runs the CLI out of the digest-pinned image', () => {
    const dir = scratch('image-good')
    const { path, engine } = containerEngine(dir, {
      inspect: [0, `["ghcr.io/ezclassify/cli@${DIGEST}"]`],
      run: [0, '1.0.0'],
    })
    const pin = pinFile(dir, { image: { ref: 'ghcr.io/ezclassify/cli', digest: DIGEST } })

    const result = run(resolver, ['--pin', pin, '--work-dir', join(dir, 'work')], {
      PATH: path,
      EZCLASSIFY_CONTAINER_ENGINE: engine,
    })

    expect(result.status).toBe(0)
    expect(result.output).toContain('resolved the pinned CLI from the image')
    const wrapper = readFileSync(join(dir, 'work', 'ezclassify'), 'utf-8')
    expect(wrapper).toContain(`ghcr.io/ezclassify/cli@${DIGEST}`)
    expect(wrapper).toContain("--entrypoint 'ezclassify'")
    expect(wrapper).toContain(`${repositoryRoot}:/workspace`)
  })

  it('refuses an image reference that is not one', () => {
    const dir = scratch('image-ref')
    const pin = pinFile(dir, { image: { ref: 'ghcr.io/ezclassify/cli; echo', digest: DIGEST } })

    // The reference ends up in a generated shell wrapper, so the pin check is
    // where a value that is not a reference stops.
    const result = run(pinCheck, ['--pin', pin])

    expect(result.status).toBe(1)
    expect(result.output).toContain('image.ref must be an image reference')
  })
})

describe('an unconfigured pin needs a supplied CLI', () => {
  it('resolves nothing and stays green', () => {
    const result = run(resolver, ['--work-dir', join(scratch('unconfigured'), 'work')])

    expect(result.status).toBe(0)
    expect(result.output).toContain('declares no verified CLI download')
    expect(result.output).not.toContain('EZCLASSIFY_CLI')
  })

  it('fails the behavioral lane when no CLI is available', () => {
    const result = run(suites, [], { PATH: join(scratch('no-path'), 'bin') })

    expect(result.status).toBe(1)
    expect(result.output).toContain('required lane cannot run')
    expect(result.output).toContain('declares no verified public download')
  })

  it('runs the suites when a CLI was resolved', () => {
    const dir = scratch('suite-run')
    const cli = join(dir, 'ezclassify')
    writeFileSync(cli, WORKING_CLI, { mode: 0o755 })

    const result = run(suites, [], { EZCLASSIFY_CLI: cli })

    expect(result.status).toBe(0)
    expect(result.output).toContain('scheme test scheme-folder')
  })
})

describe('the committed pin', () => {
  it('passes its own guard', () => {
    const result = run(pinCheck, [])

    expect(result.status).toBe(0)
    expect(result.output).toContain('no public download yet')
  })

  it('may not name a file URL, however an operator resolves one locally', () => {
    const dir = scratch('committed')
    const archive = tarball(dir, 'cli', [['ezclassify', WORKING_CLI]])
    const pin = pinFile(dir, archivePin(archive))

    // The resolver accepts a file URL, proved above. What the repository is
    // allowed to commit is the stricter question, and the answer is https.
    const result = run(pinCheck, ['--pin', pin])

    expect(result.status).toBe(1)
    expect(result.output).toContain('archive.url must be https://')
  })

  it('accepts a fully declared archive and image pair', () => {
    const dir = scratch('both')
    const pin = pinFile(dir, {
      archive: { url: 'https://example.invalid/ezclassify.tar.gz', sha256: 'd'.repeat(64) },
      image: { ref: 'ghcr.io/ezclassify/cli', digest: DIGEST },
    })

    const result = run(pinCheck, ['--pin', pin])

    expect(result.status).toBe(0)
    expect(result.output).toContain('pinned by archive + image')
    expect(result.output).toContain('must run')
  })

  it('refuses a tested version that is a prerelease of the declared minimum', () => {
    const dir = scratch('prerelease')
    const pin = pinFile(dir, {
      minimumVersion: '1.0.0',
      testedVersion: '1.0.0-rc.1',
      archive: { url: 'https://example.invalid/ezclassify.tar.gz', sha256: 'd'.repeat(64) },
    })

    // A release candidate precedes the release it leads to, so pinning one
    // against a 1.0.0 minimum promises coverage the pin does not have.
    const result = run(pinCheck, ['--pin', pin])

    expect(result.status).toBe(1)
    expect(result.output).toContain('is below minimumVersion')
  })

  it('refuses a source declared without its checksum', () => {
    const dir = scratch('unchecksummed')
    const pin = pinFile(dir, {
      archive: { url: 'https://example.invalid/ezclassify.tar.gz', sha256: null },
    })

    const result = run(pinCheck, ['--pin', pin])

    expect(result.status).toBe(1)
    expect(result.output).toContain('archive.sha256 must be')
  })
})

describe('behavioral failure reporting', () => {
  it('reports a missing CLI as failed to GitHub Actions', () => {
    const dir = scratch('missing-status')
    const output = join(dir, 'github-output')
    const result = run(suites, [], { PATH: join(dir, 'no-cli'), GITHUB_OUTPUT: output })
    expect(result.status).toBe(1)
    expect(readFileSync(output, 'utf8')).toContain('status=failed')
    expect(readFileSync(output, 'utf8')).not.toContain('status=skipped')
  })
})
