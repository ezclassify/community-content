# Agent Instructions

## Standards

Read [`STANDARDS.md`](./STANDARDS.md) before any feature, refactor, architectural decision, or task > 30 minutes. These engineering standards apply to you as they do to any contributor. Skip for: quick bug fixes, typos, documentation-only changes.

Read [`ARCHITECTURE.md`](./ARCHITECTURE.md) before changing scheme ownership,
generated bundles, shared validators, or dependency direction.

## Lockfile policy

`package-lock.json` is untracked. CI generates an ephemeral lockfile from a
clean dependency state, then runs `npm ci` and the dependency-quarantine gate
against those exact bytes.

Third-party entries are pinned by `resolved` + `integrity`, as usual. First-party
(`@ezclassify/*`) entries are deliberately **not** pinned: development builds
of this repo's own dependencies are republished in place with changing
integrity hashes, so pinning them would break the next `npm ci` the moment one
is republished. `npm run deps:relock` produces this shape in one step: a
date-bounded resolve of the third-party tree, followed by an unbounded
re-add of first-party packages, followed by stripping `resolved`/`integrity`
from the first-party entries. `npm ci` then re-resolves those through
whichever `@ezclassify:registry` the running environment configures.
`npm run check:lockfile-portable` guards this shape in CI so a plain
`npm install` on a machine with a local registry configured cannot
reintroduce a machine-local URL or a first-party pin unnoticed.

Run `npm run deps:relock` after any dependency change and to produce CI's
ephemeral lock; do not hand-edit it. The command removes both `node_modules`
and `package-lock.json`, includes optional dependencies, and regenerates from
the manifests.
