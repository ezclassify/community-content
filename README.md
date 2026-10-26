# <img src="https://raw.githubusercontent.com/ezclassify/community-content/main/assets/icon.svg" alt="" width="32"> EzClassify Community Schemes

[![CI](https://github.com/ezclassify/community-content/actions/workflows/ci.yml/badge.svg)](https://github.com/ezclassify/community-content/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40ezclassify%2Fschemes?label=%40ezclassify%2Fschemes)](https://www.npmjs.com/package/@ezclassify/schemes)
[![license: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node.js 22 | 24](https://img.shields.io/badge/node-22%20%7C%2024-339933.svg)](package.json)

Open-source marking schemes for EzClassify. Apache-2.0 licensed.

## What's a scheme?

A scheme is a declarative YAML document that describes a marking system: its
concepts (for example, `TLP:AMBER` or the `AV:N` metric value in a CVSS
vector), categories, parse rules, legal combinations, aggregation rules, and
render formats. Give a scheme to an EzClassify runtime and it can parse,
validate, aggregate, render, and suggest markings in that system without
anyone writing scheme-specific code.

This repository holds the schemes. It does not hold an engine. The EzClassify
engine is proprietary and runs inside EzClassify applications. Authoring,
building, and schema validation here use public tools. A Runtime license includes
the full CLI and its local scheme tests, along with REST and MCP. Studio is
optional. Contributors without Runtime can submit suites and request a
maintainer-assisted behavioral run. Hosted pilot runs are not yet available;
confirm availability with a maintainer. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Installing a scheme

Schemes are content. They go into an EzClassify application, which is what
runs them.

The npm package provides compiled JSON content for tooling and local document
workflows:

```text
dist/schemes/
  tlp@2.0.0.json
  cvss@3.1.0.json
  cvss-v4@4.0.0.json
  contexts.json
```

```bash
npm install @ezclassify/schemes
```

The files are plain JSON, so non-Node tools can read or copy them without
executing JavaScript. The licensed [CLI's document commands](https://ezclassify.com/docs/cli) can read
this component directory through `SCHEME_DIR`.

For production REST and MCP deployments, an administrator installs verified
artifacts in the runtime's artifact repository and supplies a published Context
to the application. Studio-managed deployments receive community schemes
through the signed catalog delivery workflow. Follow the
[runtime installation guide](https://ezclassify.com/docs/deploy-docker) for
deployment setup. Studio licensees receive the installation and catalog
onboarding guides with their delivery.

### Reading the authored YAML

Each scheme also has a subpath export carrying its authored YAML as a string,
byte-identical to the file in this repository. This is for a consumer who
wants the source document rather than the compiled JSON, to diff it against a
local copy or feed it to their own tooling:

```js
import { tlpSchemeYaml } from '@ezclassify/schemes/tlp';

console.log(tlpSchemeYaml.startsWith('scheme:')); // true
```

`@ezclassify/schemes/cvss` and `@ezclassify/schemes/cvss-v4` export
`cvssSchemeYaml` and `cvssV4SchemeYaml`. Importing the package root re-exports
every published scheme. The package has no runtime dependencies.

## API reference

The [package and content API guide](docs/API.md) covers YAML exports, compiled
documents, Contexts, and behavior suites, with a separate maintainer source
reference for package modules and scripts.

## Catalog

The catalog includes public standards and three fictional Cedar Valley teaching schemes.

### sensitivity-marking/

| Scheme | Purpose                                                                  |
| ------ | ------------------------------------------------------------------------ |
| `tlp`  | Traffic Light Protocol v2.0 (CLEAR / GREEN / AMBER / AMBER+STRICT / RED) |

### security-vectors/

| Scheme    | Purpose                  |
| --------- | ------------------------ |
| `cvss`    | CVSS v3.1 vector strings |
| `cvss-v4` | CVSS v4.0 vector strings |

Maintained schemes for IC Classification and Control Markings (CAPCO), CUI,
and NATO are part of the licensed EzClassify catalog. This repository contains
public standards and the approved fictional Cedar Valley teaching content.

### demo/

| Scheme                    | Purpose                                                                         |
| ------------------------- | ------------------------------------------------------------------------------- |
| `cedar-valley-protection` | Four protection levels, guidance, and clearance checks                          |
| `cedar-valley-handling`   | Protection plus human handling instructions                                     |
| `cedar-valley`            | Full district example with sensitive content, school and recipient restrictions |

[Cedar Valley](schemes/demo/cedar-valley/README.md) is fictional teaching content authored by EzClassify. It does not represent a real district policy or compliance standard. The three contexts include matching guides and access policies. This repository owns their canonical source; maintained examples consume copies.

For application integration tests, use the [scenario server](https://github.com/ezclassify/contracts/tree/main/packages/conformance-server#testing-an-application-integration). It serves a finite set of recorded Cedar Valley responses and transport failures through the normal REST contract. It requires no runtime license.

## How a scheme here is checked

Two gates, and they answer different questions.

**Shape.** `npm run validate` checks every document against its published JSON
Schema and checks that the folder's manifest matches the files on disk. It
uses `@ezclassify/validator`, which is public, so it runs on a clean clone
with nothing installed but this repository's own dependencies.

**Behavior.** Each scheme carries test suites in [`scheme-folder/test-suites/`](scheme-folder/test-suites/),
stating inputs and the outcomes they must produce. They are data, not code.
The EzClassify CLI runs them:

```bash
ezclassify scheme test ./scheme-folder
```

Running the suites locally requires a Runtime license. Authoring a scheme,
validating it, and opening a pull request do not. Contributors can request the
maintainer-assisted pilot described in [CONTRIBUTING.md](CONTRIBUTING.md), which
also explains its current availability and the independent public CI checks.

## Contributing a scheme

A new scheme is one YAML file plus its test suites, docs, and a source
citation. Every scheme must cite an authoritative source (a published
standard, RFC, or governing document). Cedar Valley is the maintained exception
for fictional teaching content; other custom marking systems belong in your
application. [CONTRIBUTING.md](CONTRIBUTING.md) walks the full submission
flow, the repo layout, and the commands, with the non-negotiables in
[`RULES.md`](RULES.md) and engineering standards in [`STANDARDS.md`](STANDARDS.md).

## Reporting issues

Issues for every EzClassify app are tracked in [ezclassify/ezclassify](https://github.com/ezclassify/ezclassify/issues/new/choose). Choose the bug report, feature request, or documentation form and answer "What are you using?" with "Marking schemes and content". For a scheme that breaks its own access-control rules, follow the Security note below instead.

## Security

Most scheme bugs are authoring errors, not security issues. If you find a scheme that would leak, misclassify, or mislabel data in a way that breaks its own access-control rules, email security@ezclassify.com rather than opening a public issue. See [SECURITY.md](SECURITY.md).

## License

[Apache-2.0](LICENSE) © EzClassify, LLC.
