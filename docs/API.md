# Package and content API

`@ezclassify/schemes` exposes authored YAML strings and compiled JSON documents.
The package has no runtime dependencies. Evaluating markings requires an
EzClassify runtime; importing content does not evaluate it.

## Generate the reference

From this repository, after `npm install`:

```bash
npm run docs
```

Open `docs/api/index.html`. TypeDoc reads [`src/index.ts`](../src/index.ts) and the JSDoc on its
exports. The command fetches pinned TypeDoc and TypeScript tools through npm
when they are not cached. Generated HTML is local build output and is excluded
from the npm tarball. `npm run build` separately generates the distributable
JavaScript, declarations, and JSON content.

`npm run docs:source` separately generates `docs/source/index.html` from the
maintained package source and ESM maintenance scripts. It includes internal
exports that are not supported package import paths. Tests, build output,
scheme data, and dependency trees are excluded. TypeDoc describes exported
source symbols; it does not evaluate schemes or document shell workflows.

## Authored YAML strings

Every constant has type `string` and preserves the bytes of its authored
`scheme-folder/schemes/<id>@<version>.yaml` document. Each subpath has one named
export; the package root re-exports all six. Both ESM and CommonJS are supported.

| Import subpath | Named export | Authored scheme |
| --- | --- | --- |
| `@ezclassify/schemes/tlp` | `tlpSchemeYaml` | `tlp@2.0.0` |
| `@ezclassify/schemes/cvss` | `cvssSchemeYaml` | `cvss@3.1.0` |
| `@ezclassify/schemes/cvss-v4` | `cvssV4SchemeYaml` | `cvss-v4@4.0.0` |
| `@ezclassify/schemes/cedar-valley` | `cedarValleySchemeYaml` | `cedar-valley@1.0.0` |
| `@ezclassify/schemes/cedar-valley-protection` | `cedarValleyProtectionSchemeYaml` | `cedar-valley-protection@1.0.0` |
| `@ezclassify/schemes/cedar-valley-handling` | `cedarValleyHandlingSchemeYaml` | `cedar-valley-handling@1.0.0` |

```js
import { tlpSchemeYaml } from '@ezclassify/schemes/tlp';

console.log(tlpSchemeYaml.startsWith('scheme:')); // true
```

The Cedar Valley schemes are fictional teaching content, not district policy
or a compliance standard. YAML exports contain schemes only; guides and access
policies are available in the compiled content below.

## Compiled documents

`npm run build` validates definitions and writes JSON to `dist/schemes/`.
Use the following package subpaths to resolve the files from a Node application,
or read the files directly from a copied content directory in other languages.

| Package subpath after `@ezclassify/schemes/` | JSON document |
| --- | --- |
| `<id>@<version>.json` | `{ "scheme": { ... } }` |
| `<id>@<version>.guide.json` | `{ "guide": { ... } }` |
| `<id>@<version>.access.json` | `{ "access": { ... } }` |
| `contexts.json` | `{ "contexts": [ ... ] }` |

For example, resolve a document without importing it as a JavaScript module:

```js
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const document = JSON.parse(readFileSync(
  require.resolve('@ezclassify/schemes/tlp@2.0.0.json'), 'utf8',
));
console.log(document.scheme.id); // tlp
```

The Context index contains concrete versions and one `latest` alias per
published Context ID. A manifest-declared latest version wins when present in
the published inventory; otherwise the highest semantic version wins. An alias
duplicates that Context entry with `version: "latest"`; its component references
retain concrete versions. Contexts marked `publish: false` in the folder
manifest are excluded. Layer references appear under `scheme.layers`.

## Behavior suites

`@ezclassify/schemes/test-suites.json` resolves to the compiled suite index:

```json
{
  "testSuites": [
    {
      "id": "tlp-tests",
      "version": "1.0.0",
      "testPolicy": { "kind": "scheme", "id": "tlp", "version": "2.0.0" },
      "filename": "tlp-tests@1.0.0.json"
    }
  ]
}
```

The example shows one entry, not the complete inventory. Each `filename` is
relative to the `@ezclassify/schemes/test-suites/` subpath. For example,
`@ezclassify/schemes/test-suites/tlp-tests@1.0.0.json` contains
`{ "testSuite": { ... } }`.

`testPolicy` identifies the suite's access policy when present, otherwise its
first guide, otherwise its scheme. It uses the suite's own composition or the
nearest ancestor composition for a suite that extends another suite. The
compiled suite preserves its authored content, including any `extends`
reference; bundling does not flatten inheritance or execute cases.

`npm run validate` checks schema and folder consistency. The licensed CLI
executes the behavior assertions with `ezclassify scheme test ./scheme-folder`.
See [CONTRIBUTING.md](../CONTRIBUTING.md) for suite authoring and local execution.
