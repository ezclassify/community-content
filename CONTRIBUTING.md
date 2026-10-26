# Contributing Community Schemes

Thank you for contributing to the EzClassify scheme catalog!

> Contribution terms on this page are pending review by counsel. They describe
> how we take contributions today and are not legal advice.

## Before You Start

1. **Sign off your commits.** This project uses the
   [Developer Certificate of Origin](https://developercertificate.org/) rather
   than a contributor license agreement. Sign off each commit with
   `git commit -s`, which appends a line like
   `Signed-off-by: Jane Doe <jane@example.com>` using your real name. That line
   is your statement that you wrote the contribution or otherwise have the
   right to submit it under this repository's license. Every commit in a pull
   request needs one.

2. **Fork the repository.** All contributions come through pull requests from
   forks. Direct pushes to the official repository are not permitted.

## Working in this repo

```bash
git clone https://github.com/ezclassify/community-content.git
cd community-content
npm install
npm run validate  # schema, folder and test suite checks
npm test          # repository specs
npm run build     # compile every scheme to dist/schemes/
```

Every command above runs on a clean clone with no EzClassify license, no
credentials, and no engine. They are the same commands CI runs.

The source of truth is the scheme folder. Each definition lives flat at
`scheme-folder/schemes/<id>@<version>.yaml`, with a
[`scheme-folder/scheme-folder.yaml`](scheme-folder/scheme-folder.yaml) manifest indexing it and its test suites
beside it in [`scheme-folder/test-suites/`](scheme-folder/test-suites/). Each scheme's docs and
citations live under `schemes/<family>/<id>/`.

| Action          | Command                                  | What it does                                                                                                                                                                                                                                                                                                    |
| --------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Validate        | `npm run validate`                       | Checks every definition against its published JSON Schema with `@ezclassify/validator`, checks the manifest against the files on disk, and checks every test suite against the published suite schema and against the definitions this folder holds. Shape and bookkeeping only: nothing here evaluates a rule. |
| Format manifest | `npm run fmt`                            | Rewrites [`scheme-folder/scheme-folder.yaml`](scheme-folder/scheme-folder.yaml) to index every definition on disk, and renames files to `<id>@<version>.yaml`. Run it after adding or renaming a scheme.                                                                                                        |
| Build           | `npm run build`                          | Compiles every scheme to `dist/schemes/<id>@<version>.json` plus `contexts.json`, and every test suite to `dist/test-suites/`. That `dist/` is what ships in the `@ezclassify/schemes` npm package.                                                                                                             |
| Test            | `npm test`                               | Runs Vitest across the repository specs (`npm run test:verbose` for serial verbose).                                                                                                                                                                                                                            |
| Test suites     | `ezclassify scheme test ./scheme-folder` | Runs every test suite against the real engine. Needs the EzClassify CLI; see below.                                                                                                                                                                                                                             |
| Clean           | `npm run clean`                          | Remove build/test artifacts (`:cache` cache-only, `:deep` everything).                                                                                                                                                                                                                                          |

## Generated references

Run `npm run docs` to generate the public package reference at
`docs/api/index.html`, or `npm run docs:source` for source modules and scripts at
`docs/source/index.html`. See [the API guide](docs/API.md) for content contracts
and reference coverage. Both commands use pinned npm tools and leave generated
HTML untracked.

## The two kinds of test, and which one CI runs

**Shape and bookkeeping.** `npm run validate` and `npm test` answer whether a
document is well-formed, says what you meant it to say, is indexed correctly,
and has suites that compose real artifacts. These need no engine, so they run
on every pull request, including pull requests from forks, and they are
required to pass.

**Behavior.** How a marking parses, renders, aggregates, or trips a rule is a
question only the engine answers. Those expectations live as test suites in
[`scheme-folder/test-suites/`](scheme-folder/test-suites/), and the EzClassify CLI runs them:

```bash
ezclassify scheme test ./scheme-folder
ezclassify scheme test ./scheme-folder/test-suites/tlp-tests@1.0.0.yaml
ezclassify scheme test ./scheme-folder --json --report ./test-results/schemes.json
```

The first form runs every suite in the folder; the second runs the files you
name. A run in which no case runs is a failure, not a pass.

A Runtime license includes the full CLI, including scheme tests, along with
REST and MCP. Studio is optional and is not required to run the CLI. The CLI
is proprietary and is not on npm. Licensed users can run `npm run test:behavior`
when an executable is available on PATH or through `EZCLASSIFY_CLI`. This
explicit local lane fails if the CLI is unavailable. Public schema and tooling
checks remain runnable without Runtime.

### Contributing without a Runtime license

You can author schemes and canonical test suites, run the public checks above,
and open a draft PR without buying Runtime or Studio. Ask a maintainer for a
behavioral run of your contribution.

Maintainer-assisted behavioral testing is in pilot. Hosted runs are not yet
available; confirm availability with a maintainer before relying on a requested
run. The intended workflow is:

1. A maintainer reviews the public contribution and approves its exact current
   head SHA.
2. A fixed private runner evaluates only the approved declarative data. It
   does not execute your scripts, workflows or dependency installation, and
   does not distribute the engine or a reusable Runtime license.
3. The maintainer downloads the full canonical JSON report and approval receipt,
   checks that the PR still has the approved head, and posts both to the PR.
   The receipt identifies the commit and engine build; private artifact links
   alone are not usable by contributors.
4. A changed head requires another review and run. An earlier report remains
   evidence for its recorded commit only.

This pilot accepts public contributions to this repository, with self-contained
YAML definitions and suites. Materialize external sources inline first. Do not
submit private material or licensed vendor content without the rights to make
it public. Private and offline engine testing requires Runtime rights.

CI in this public repository runs the independent schema, tooling and package
checks. A green public CI run does not claim that engine behavior was tested;
the full report records an actual behavioral run separately. No case is
reported as passed merely because the engine was unavailable.

## Writing a test suite

A test suite is one YAML file in [`scheme-folder/test-suites/`](scheme-folder/test-suites/), named
`<id>@<version>.yaml` for the suite it holds. It names the exact definitions it
runs against in `composition`, and each case states an operation, its input,
and the assertions the result must satisfy:

```yaml
testSuite:
    apiVersion: schemes.ezclassify.com/v1
    id: tlp-tests
    version: 1.0.0
    composition:
        scheme:
            id: tlp
            version: 2.0.0
    cases:
        - id: red-round-trip
          description: The canonical form parses and renders back unchanged.
          operation: process
          input:
              marking: 'TLP:RED'
          assertions:
              - { path: [valid], matcher: equals, value: true }
              - { path: [rendered], matcher: equals, value: 'TLP:RED' }
              - path: [assertions]
                matcher: contains
                value: { conceptId: TLP_RED, categoryId: tlp_level }
```

Studio exports and imports the same document, so a suite written here and a
suite written in Studio are interchangeable.

What `npm run validate` and the CLI both hold a suite to:

- The file holds one document under a single `testSuite:` key, and it satisfies
  the published suite schema in `@ezclassify/schemas`.
- `id` and `version` match the file name. Case ids are unique within the suite.
- The composition names exact versions of definitions this folder holds: a
  `scheme`, plus `guides` or an `access` policy when the cases need them. A
  suite may instead `extends` another suite in the folder and inherit its
  composition and cases.
- Every scheme version in the folder is the scheme of at least one suite.
- An assertion reads one value at an exact `path` into the operation's result
  and compares it with `equals`, `notEquals`, `contains`, `excludes`, `exists`
  or `absent`. Array indices are path segments (`[errors, '0', constraintId]`).
  There is no scripting and no snapshot.
- Assert on concept ids and stable constraint ids, not on English message text.
  Messages get reworded; ids do not.

Operations available to a case: `process`, `validate`, `explain`, `aggregate`,
`render`, `suggest`, `suggestForCategories`, `schemeScan`, `guideScan`,
`guideEvaluate`, `checkAccess`, `auditDocument`, `assessDocumentAccess` and
`translate`. A guide, access or crosswalk operation needs that policy in the
composition. The suites in
[`scheme-folder/test-suites/`](scheme-folder/test-suites/) are the best worked examples;
`tlp-tests@1.0.0.yaml` is a compact one to crib from.

## Submitting a New Scheme

1. Fork the repository and create a branch: `git checkout -b scheme/my-scheme-name`
2. Add the definition to the scheme folder: `scheme-folder/schemes/my-scheme-name@1.0.0.yaml`
   (the file name must be `<id>@<version>.yaml`, matching the in-file `id` and `version`).
3. Refresh the manifest: `npm run fmt`, then `npm run validate`.
4. Add at least one test suite whose composition names the scheme, for example
   `scheme-folder/test-suites/my-scheme-name-tests@1.0.0.yaml`. A scheme with no suite fails
   validation: shipping a marking system with no stated expected behavior is
   not something this catalog does.
5. Add the scheme's docs under `schemes/<family>/my-scheme-name/`:
    - [`README.md`](README.md): scheme description, stats, example marking, and a source
      citation. Required.
    - [`docs/`](docs/): optional supporting notes. `sources.md` for the full citation and
      `traceability.md` mapping each concept to its section of the source are
      both encouraged for standards-heavy schemes. `sensitivity-marking/tlp/`
      shows the full layout.
6. Run `npm run validate && npm test && npm run build`.
7. Open a pull request.

## Scheme Quality Checklist

- [ ] Scheme passes schema validation (`npm run validate`)
- [ ] All concepts have `views.default` set
- [ ] Parse rules cover every concept the scheme expects to accept
- [ ] At least one test suite, covering parse, render, and aggregation
      where the scheme supports them
- [ ] Suites assert on concept IDs and constraint IDs, never English message text
- [ ] README.md with description, source citation, and example
- [ ] Vocabulary: use "scheme" in ids, file names, descriptions, and docs

## Scheme YAML Structure

Every definition file wraps its content in a top-level `scheme:` key (a bare
file is refused). Vocabulary lives under `data:`, rendering under `render:`.

```yaml
scheme:
    id: my-scheme # unique, lowercase, hyphenated
    version: 1.0.0
    name: My Scheme Name
    description: >
        What this scheme classifies and its authoritative source.
    data:
        categories:
            - id: level
              label: Level
              required: true
              single: true
              rollup: max
              position: 0
        concepts:
            inline:
                - id: LOW
                  name: Low
                  views:
                      default: LOW
                  aliases:
                      - LOW
                  categories:
                      - level
                  position: 0
                  rank: 0
                - id: HIGH
                  name: High
                  views:
                      default: HIGH
                  aliases:
                      - HIGH
                  categories:
                      - level
                  position: 1
                  rank: 1
    render:
        default: default
        formats:
            - id: default
              view: default
              surface: default
              mode: inline
              separator: ''
              fields:
                  - category: level
                    separator: ''
    default_scope: default
    scopes:
        - id: default
          label: Default
```

Optional sections at the same level as `data:`: `rules:` (inference),
`parse:` (`case_sensitive`, `strip_whitespace`, `recognizers`, `normalize`),
and per-concept `definition` and `guidance`. Separators belong to a format
and to its fields, never to `parse:`. The schemes already in this repo are
the best worked examples. `tlp` is a compact one to crib from.

## Tests

Repository specs use **Vitest** (not Jest). Use `vi.fn()`, never `jest.fn()`.
They cover this repository's own concerns: document shape, packaging, exports,
notices, and the folder tooling. Scheme behavior belongs in a declarative
suite, not in a spec file.

## License

By contributing, you agree that your contributions are licensed under the
Apache License 2.0, the license this repository carries. Your `Signed-off-by`
line is how you say you have the right to submit them on those terms; see the
[Developer Certificate of Origin](https://developercertificate.org/).

## Writing Style

Write docs and README prose in plain, short sentences. Do not use em dashes. Split the thought into two sentences, or use a comma or colon instead. This keeps every scheme's docs in the same house style.

## Questions?

Open an issue on the [central EzClassify tracker](https://github.com/ezclassify/ezclassify/issues/new/choose) and answer
"What are you using?" with "Marking schemes and content".
