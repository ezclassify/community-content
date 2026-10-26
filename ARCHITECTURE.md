# Architecture Ownership

## Sources of truth

The [ezclassify/contracts](https://github.com/ezclassify/contracts) repository publishes
`@ezclassify/schemas`, which defines valid document structure. EzClassify Runtime
evaluates Scheme, Guide, Access, and Context behavior. Each scheme directory
owns its domain data, cited source provenance, version, examples, and tests.
Repository validators and bundlers enforce the common folder contract; they
do not redefine engine semantics.

## Generated code

Published scheme bundles and catalogs are generated from the committed scheme
folder. Build output is reproducible and remains untracked. The test suites in
[`scheme-folder/test-suites/`](scheme-folder/test-suites/) are authored YAML; the build compiles them to JSON
under `dist/test-suites/` and does not change what they assert.

Formatting may normalize data files, but a formatter does not infer policy or
source claims.

## Handwritten seams

This repository owns community-maintained scheme, guide, access, and source
artifacts; domain-specific tests; folder validation; catalog assembly; and
package construction. Domain terminology belongs in those artifacts and their
documentation.

[`src/`](src/) holds the package's library entry points, one directory per published
scheme subpath. Each exports the raw YAML string of its scheme, inlined from
the authored file at build time so the export is byte-identical to the source.
That is the whole contract: it carries no scheme logic, no engine behavior, and
no per-scheme special cases. A new scheme that should be reachable from the npm
package gets a directory here, a [`vite.config.ts`](vite.config.ts) entry, and an `exports` entry
in [`package.json`](package.json). The published package has no production dependencies, and
nothing belongs in `dependencies`.

Consumers who prefer the compiled wire format read the JSON under
`dist/schemes/` through the `./*` export instead. Both paths describe the same
authored scheme; neither is a fork of the other. Test suite consumers read
`./test-suites.json` for the policy each suite qualifies (its access policy,
else its first guide, else its scheme) and `./test-suites/*` for the compiled
suites. This adds no production dependency or engine behavior.

Shared validation or bundling behavior used by more than one scheme belongs in
the repository scripts or test helpers, once. Scheme-local code is reserved for
genuinely scheme-specific assertions.

## Forbidden ownership

Do not implement or fork SchemeEngine, GuideEngine, AccessEngine, Context
composition, canonical evidence/provenance algorithms, or web presentation
behavior. A scheme describes policy as data through the public contract; it
does not patch runtime behavior to obtain a desired result.

Do not copy licensed catalog schemes, private source inventories, customer
material, or unsupported compliance claims into this public repository.

## Required gates

- `npm run validate` (document shape, folder bookkeeping, test suites)
- `npm test`
- `npm run typecheck`, `npm run lint`, and `npm run format:check`
- `npm run build` and package-consumption verification
- source/license/provenance review for every new or changed scheme family
- no-escape and public/private content scans before release

A scheme change must include a test suite in [`scheme-folder/test-suites/`](scheme-folder/test-suites/)
proving the data produces the intended canonical result. Suites are data; the
EzClassify CLI evaluates them (`ezclassify scheme test ./scheme-folder`),
because evaluating a marking needs the engine and this repository has none.
`npm run validate` checks every suite against the published suite schema,
checks that every published scheme has a suite, and checks that every suite
composes definitions this folder holds; it does not evaluate one. A runtime
behavior change belongs in the runtime and must not be hidden in a scheme
fixture.
