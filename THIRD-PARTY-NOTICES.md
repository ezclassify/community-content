# Third-Party Notices

The published package `@ezclassify/schemes` is licensed under the Apache-2.0 License
(see `LICENSE`, Copyright (c) 2026 EzClassify, LLC).

**This package bundles no third-party runtime code and has no production
dependencies.** Its `package.json` declares no `dependencies`.

Beyond that there is no first-party runtime dependency. This package ships
scheme documents; the engine that reads them is supplied by the consuming
application and is not pinned here.

What ships in the published tarball is a tree of compiled `scheme.json` data
documents under `dist/schemes/`, plus the compiled JavaScript and type
declarations of the package entry points under `dist/lib/`. The data documents
are EzClassify authored classification-scheme definitions. The entry points are
EzClassify authored source, compiled from `src/`; they import nothing beyond
the Node built-ins.

The published set is declared by the `files` field: `dist`, `!dist/**/*.map`, `README.md`, `LICENSE`, `THIRD-PARTY-NOTICES.md`.

The toolchain used to author, validate, and build the schemes is declared
under `devDependencies`. None of it is imported by the shipped artifact,
none of it is redistributed in a consuming install, and so it is out of
scope for this notice.

There is therefore nothing third-party to attribute for a runtime install
of this package.
