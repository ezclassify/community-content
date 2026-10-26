# EzClassify Community Schemes Project Rules

These rules define what belongs in this repository and how to contribute to it. They apply to every contributor, human or automated. Pull requests are evaluated against this document, and automated review bots use it as their source of truth.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the submission workflow (sign-off, fork, PR process). This file defines the rules that submissions must follow.

---

## 1. What belongs in this repo

This repository contains **scheme definitions**: YAML files that describe marking and tagging systems, along with the tests that validate them.

Definitions follow the scheme-folder convention: every scheme is one YAML file in the scheme folder, named `<id>@<version>.yaml`, indexed by the [`scheme-folder/scheme-folder.yaml`](scheme-folder/scheme-folder.yaml) manifest.

- `scheme-folder/schemes/<scheme-id>@<version>.yaml`: the scheme definition (one file per version).
- [`scheme-folder/scheme-folder.yaml`](scheme-folder/scheme-folder.yaml): the manifest (regenerate with `npm run fmt`).
- `scheme-folder/test-suites/<suite-id>@<version>.yaml`: the test suites. Round-trip and aggregation expectations live here, as data, each suite naming the exact scheme version it runs against.
- `schemes/<family>/<scheme-id>/tests/<scheme-id>.spec.ts`: the document contract. What the YAML declares, asserted without an engine.
- `schemes/<family>/<scheme-id>/README.md`: scheme description, authoritative source, example usage.

Examples of schemes that belong here: TLP, CVSS, general-purpose severity scales, open industry classification schemes whose authoritative source is a public standard.

The three fictional Cedar Valley teaching schemes and their matching guides, access policies, and Contexts are an approved exception. This repository owns those twelve teaching artifacts; see [ARCHITECTURE.md](ARCHITECTURE.md).

## 2. What does NOT belong in this repo

- **Engine code.** The parsing, rendering, aggregation, and validation logic is the EzClassify engine, which is proprietary and is not a dependency of this repository. Do not add code here that duplicates or extends engine behavior. If your scheme needs a capability the engine does not support, open an issue at [github.com/ezclassify/ezclassify](https://github.com/ezclassify/ezclassify) before authoring around it.
- **Schemes that belong in the paid catalog.** The dividing line is not the domain. Regulatory-adjacent schemes such as NERC CIP, IRB, or ASIL are welcome here alongside the paid catalog's entries. The line is the nature of the work. A scheme belongs HERE when it mechanically encodes a standard's public vocabulary, the labels, levels, and identifiers practitioners already use openly (TLP colors, CVSS metrics, ASIL levels, CIP standard numbers), such that the YAML can carry Apache-2.0 without reproducing protected text or infringing anyone's rights. The standard's full text need not be free (ISO 26262 isn't); the encoded vocabulary must be. A scheme belongs in the PAID catalog when its value is EzClassify's authored interpretation and ongoing maintenance of a complex or moving register (tracking the IC Markings Register or NARA CUI Registry across editions, per-concept authority citations, semantic judgment calls), or when it would substitute for an existing paid-catalog entry. When in doubt, or when a proposal overlaps a paid entry's scope, open an issue before authoring and let maintainers make the call.
- **Framework integrations, UI components, or application code.** This repo is scheme data and validation only.
- **Hardcoded scheme-specific vocabulary outside the scheme's own directory.** A TLP test should not reference US Government concept IDs, and vice versa.

## 3. Scheme quality requirements

Every scheme in this repository must satisfy the following before merge:

- [ ] Scheme loads without error.
- [ ] All concepts have `views.default` set.
- [ ] Parse rules cover all concepts (a round-trip case over the full vocabulary catches gaps).
- [ ] No alias or view contains a character the scheme's own format or field separators split on.
- [ ] Behavioral suites cover both round-trip and aggregation.
- [ ] [`README.md`](README.md) with description, authoritative source citation, and example usage.
- [ ] YAML passes schema validation.
- [ ] Test assertions use concept IDs, never scheme-specific vocabulary strings in the assertion logic.
- [ ] Scheme has a unique, lowercase, hyphenated `id`.

### Authoritative source

Every scheme README must cite its authoritative source: the published standard, RFC, specification, or governing document that defines the marking system. The approved Cedar Valley teaching family cites its authored policy and is explicitly fictional. Other custom or internal schemes belong in an application repository.

## 4. Scheme schema

The canonical schema ships in the `@ezclassify/schemas` package and is applied by `@ezclassify/validator` during `npm run validate`. Both are public packages from the [ezclassify/contracts](https://github.com/ezclassify/contracts) repository, so a contributor can check their work without a licensed runtime. The schema is the authoritative reference for every field a scheme YAML may contain, and schemes must validate against it before merge.

Validation here checks document shape, not behavior. It does not load the scheme, resolve layers, or evaluate rules. That is engine work, and the engine is not a dependency of this repository.

Existing schemes (see [`schemes/`](schemes/)) are the practical reference for how to structure a new contribution. When in doubt, copy the layout of a nearby scheme and adjust.

The mapper that converts YAML to the engine's internal types is intentionally thin: it maps snake_case to camelCase with type validation only. Use the YAML key names the canonical schema defines as the authoritative reference; do not invent alternate terminology.

## 5. Testing

Two kinds of test, and they answer different questions. CONTRIBUTING.md walks
both paths; this section is the rule.

**Document contract.** TypeScript specs under `schemes/<family>/<scheme-id>/tests/`
and [`tests/`](tests/), run by `npm test`. They assert what the YAML declares and need no
engine, so they run on every pull request.

- All specs use **Vitest**, not Jest. Use `vi.fn()`, never `jest.fn()`.
- Run them from the repo root: `npm test`.
- Assertions reference concepts by ID, not by vocabulary string. For example, assert `concept.id === 'LEVEL_HIGH'`, not `marking === 'HIGH-LABEL-TEXT'`.

**Behavior.** Test suites in [`scheme-folder/test-suites/`](scheme-folder/test-suites/), run by the
EzClassify CLI (`ezclassify scheme test ./scheme-folder`). They are
data, not code. Evaluating a marking needs the engine, which this repository
does not have, so a behavior expectation belongs in a suite and never in a spec
file.

- Round-trip cases verify that a marking parses and renders back unchanged, over a representative set.
- Aggregation cases verify that rollup produces the expected result across categories.
- Every scheme carries both.

## 6. Code quality (for test and tooling files)

Where the repo contains TypeScript (test files, validation tools):

- No `any` in source. Use `unknown` or a specific type.
- No decorative section-divider comments (`// ---`, Unicode box-drawing).
- No `Note:` / `Important:` preamble comments.
- No emoji in source code or test files unless explicitly part of test data.
- `npm test` and `npm run validate` must pass before merge.

## 7. Development workflow

### 7.1 Submitting a new scheme

1. Fork and branch: `git checkout -b scheme/my-scheme-name`.
2. Add the definition to `scheme-folder/schemes/my-scheme-name@1.0.0.yaml`, a test suite to `scheme-folder/test-suites/my-scheme-name-tests@1.0.0.yaml`, and the spec and docs to `schemes/<family>/my-scheme-name/` (see §1).
3. Refresh the manifest with `npm run fmt`.
4. Run `npm run validate` and `npm test` from the repo root.
5. Open a pull request.

### 7.2 Correcting an existing scheme

Include the authoritative source citation for any semantic change (adding a concept, changing a constraint, adjusting a render format). The source should be a publicly available, authoritative document.

### 7.3 Commits and PRs

- Clear, imperative-mood commit messages.
- Fork-based PRs only. Sign off every commit with `git commit -s`, per the Developer Certificate of Origin.
- PRs are evaluated against this document.

## 8. For automated reviewers and AI assistants

Automated review bots and AI coding assistants operating on this repository must read this file before proposing changes or reviews. Flag any PR that adds engine code, integration code, or application code, and redirect those contributions to the appropriate repository. Flag schemes that lack an authoritative source citation or that fail the quality checklist in §3.
