#!/usr/bin/env node
/**
 * Generate THIRD-PARTY-NOTICES.md from the current direct production
 * dependency set in package.json.
 *
 * The published artifact is a tree of compiled scheme JSON documents plus the
 * small library that exposes them, and that library has no production
 * dependencies today. CI regenerates this file and diffs it against the
 * committed copy, so the moment a production dependency is added the diff
 * fails until the notice (and a license review) catches up.
 *
 * Peer dependencies are listed separately: first-party @ezclassify/* peers
 * are attributed as EzClassify software, and any non-first-party peer or
 * production dependency gets a real attribution entry with its license read
 * from node_modules. Both the zero-dependency and the with-dependencies form
 * of the notice carry the same first-party and tarball-contents prose; only
 * the attribution list differs.
 * @module
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf-8'));

const prodDeps = Object.entries(pkg.dependencies ?? {});
const peerDeps = Object.entries(pkg.peerDependencies ?? {});
const firstPartyPeers = peerDeps.filter(([name]) => name.startsWith('@ezclassify/'));
const thirdPartyPeers = peerDeps.filter(([name]) => !name.startsWith('@ezclassify/'));
const thirdParty = [...prodDeps, ...thirdPartyPeers].sort(([a], [b]) => a.localeCompare(b));

/**
 * Read the declared license of an installed dependency.
 * @param {string} name - Package name as declared in package.json
 * @returns {string} SPDX license expression, or UNKNOWN when unreadable
 */
function licenseOf(name) {
    try {
        const depPkg = JSON.parse(
            fs.readFileSync(path.join(repoRoot, 'node_modules', name, 'package.json'), 'utf-8'),
        );
        return depPkg.license ?? 'UNKNOWN';
    } catch {
        return 'UNKNOWN';
    }
}

const lines = [];
lines.push('# Third-Party Notices');
lines.push('');
lines.push(`The published package \`${pkg.name}\` is licensed under the ${pkg.license} License`);
lines.push('(see `LICENSE`, Copyright (c) 2026 EzClassify, LLC).');
lines.push('');

if (thirdParty.length === 0) {
    lines.push('**This package bundles no third-party runtime code and has no production');
    lines.push('dependencies.** Its `package.json` declares no `dependencies`.');
} else {
    lines.push('This package declares the following third-party production dependencies.');
    lines.push('Each is used under the license named below; see the linked package for');
    lines.push('the full license text.');
    lines.push('');
    for (const [name, range] of thirdParty) {
        lines.push(`## ${name}`);
        lines.push('');
        lines.push(`- Version range: \`${range}\``);
        lines.push(`- License: ${licenseOf(name)}`);
        lines.push(`- Source: https://www.npmjs.com/package/${name}`);
        lines.push('');
    }
}
lines.push('');

if (firstPartyPeers.length > 0) {
    const peers = firstPartyPeers.map(([name]) => `\`${name}\``).join(', ');
    lines.push('Beyond that, the runtime relationship is a `peerDependency` on');
    lines.push(`${peers}, which is first-party EzClassify software, not a`);
    lines.push('third-party component.');
} else {
    lines.push('Beyond that there is no first-party runtime dependency. This package ships');
    lines.push('scheme documents; the engine that reads them is supplied by the consuming');
    lines.push('application and is not pinned here.');
}
lines.push('');

const shipped = (pkg.files ?? []).map((f) => `\`${f}\``).join(', ');
lines.push('What ships in the published tarball is a tree of compiled `scheme.json` data');
lines.push('documents under `dist/schemes/`, plus the compiled JavaScript and type');
lines.push('declarations of the package entry points under `dist/lib/`. The data documents');
lines.push('are EzClassify authored classification-scheme definitions. The entry points are');
lines.push('EzClassify authored source, compiled from `src/`; they import nothing beyond');
lines.push(
    thirdParty.length === 0 && firstPartyPeers.length === 0
        ? 'the Node built-ins.'
        : 'the dependencies and peers named above.',
);
lines.push('');
lines.push(`The published set is declared by the \`files\` field: ${shipped}.`);
lines.push('');

lines.push('The toolchain used to author, validate, and build the schemes is declared');
lines.push('under `devDependencies`. None of it is imported by the shipped artifact,');
lines.push('none of it is redistributed in a consuming install, and so it is out of');
lines.push('scope for this notice.');
lines.push('');

if (thirdParty.length === 0) {
    lines.push('There is therefore nothing third-party to attribute for a runtime install');
    lines.push('of this package.');
}
lines.push('');

const outPath = path.join(repoRoot, 'THIRD-PARTY-NOTICES.md');
fs.writeFileSync(outPath, lines.join('\n').replace(/\n{3,}/g, '\n\n'));
console.log(
    `THIRD-PARTY-NOTICES.md generated (${thirdParty.length} third-party production ` +
        `dependencies, ${firstPartyPeers.length} first-party peers).`,
);
