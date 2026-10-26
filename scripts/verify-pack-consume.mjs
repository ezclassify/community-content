#!/usr/bin/env node
/**
 * Pack this package and consume the tarball from a scratch project outside the
 * repo, so PRs catch publish regressions cheaply: exports-map paths that point
 * at files missing from the tarball, and `files` entries that never ship.
 *
 * What it does:
 *   1. `npm pack`s the package into a temp dir outside the repo.
 *   2. Installs the tarball into a fresh scratch project.
 *   3. require()s and import()s every declared entry point (exports map,
 *      including subpaths) and checks the data/file exports (./*,
 *      contexts.json) actually resolve.
 *   4. checks that no shipped file points at a source map the `files` field
 *      leaves out of the tarball.
 *   5. type-checks the shipped declarations from that scratch project with
 *      `skipLibCheck: false`, which is the only way a broken triple-slash
 *      reference or a missing .d.ts inside the tarball shows up at all.
 *
 * Build first (`npm run build`); packing does not build.
 *
 * Usage: node scripts/verify-pack-consume.mjs [--keep] [--verbose]
 *   --keep     leave the scratch dir behind for inspection (path is printed)
 *   --verbose  print every individual check
 *
 * @module
 */

import { spawnSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const keep = process.argv.includes('--keep');
const verbose = process.argv.includes('--verbose');

function readJson(filePath) {
    return JSON.parse(readFileSync(filePath, 'utf8'));
}

function run(cmd, args, opts = {}) {
    const res = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
    if (res.error) {
        // Surface spawn failures (missing file, no shebang, ...) as a failed
        // check rather than crashing the whole verification.
        return { status: -1, stdout: '', stderr: String(res.error) };
    }
    return res;
}

const failures = [];
let checks = 0;

function check(label, ok, detail) {
    checks++;
    if (ok) {
        if (verbose) console.log(`  ok  ${label}`);
    } else {
        failures.push({ label, detail });
        console.error(`FAIL  ${label}`);
        if (detail) console.error(indent(detail));
    }
}

function indent(text) {
    return String(text)
        .trim()
        .split('\n')
        .map((l) => `      ${l}`)
        .join('\n');
}

// community-content is a single-package repo: the root manifest is the
// publishable artifact, and there are no workspaces to discover.
const manifest = readJson(path.join(REPO_ROOT, 'package.json'));
const { name } = manifest;
console.log(`[pack-consume] verifying ${name}`);

// 1. pack

const scratch = mkdtempSync(path.join(os.tmpdir(), 'pack-consume-'));
const tarballDir = path.join(scratch, 'tarballs');
const consumeDir = path.join(scratch, 'consume');
mkdirSync(tarballDir);
mkdirSync(consumeDir);

const packed = run(
    'npm',
    ['pack', '--json', '--ignore-scripts', '--pack-destination', tarballDir],
    {
        cwd: REPO_ROOT,
    },
);
let packedName = null;
if (packed.status === 0) {
    try {
        packedName = JSON.parse(packed.stdout)[0]?.filename ?? null;
    } catch {
        packedName = null;
    }
}
// npm's --json filename can differ from the on-disk name for scoped packages
// across npm versions; resolve against the directory listing.
const onDisk =
    packedName && existsSync(path.join(tarballDir, packedName))
        ? packedName
        : readdirSync(tarballDir).find((f) =>
              f.startsWith(`${name.replace('@', '').replace('/', '-')}-`),
          );
check(
    `npm pack ${name}`,
    packed.status === 0 && Boolean(onDisk),
    packed.status === 0 ? 'tarball not found after pack' : packed.stderr,
);
if (failures.length > 0) finish();
const tarball = path.join(tarballDir, onDisk);

// 2. install

writeFileSync(
    path.join(consumeDir, 'package.json'),
    JSON.stringify({ name: 'pack-consume-smoke', private: true }, null, 2),
);
// --ignore-scripts matches the repo's install hardening posture; nothing
// published here relies on lifecycle scripts to be consumable.
const install = run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball], {
    cwd: consumeDir,
});
check(`npm install of the tarball into a scratch project`, install.status === 0, install.stderr);
if (failures.length > 0) finish();

// The package must have come from the tarball, never a registry: a registry
// hit means the check silently stopped testing this PR's code.
const lock = readJson(path.join(consumeDir, 'package-lock.json'));
for (const [loc, entry] of Object.entries(lock.packages ?? {})) {
    if (loc.split('node_modules/').pop() !== name) continue;
    check(
        `${name} resolved from the local tarball (not a registry)`,
        !/^https?:\/\//.test(entry.resolved ?? ''),
        `resolved: ${entry.resolved}`,
    );
}

// 3. entry-point smoke

function conditionTarget(target, condition) {
    if (typeof target === 'string') return target;
    if (Array.isArray(target)) {
        for (const t of target) {
            const hit = conditionTarget(t, condition);
            if (hit) return hit;
        }
        return null;
    }
    if (target && typeof target === 'object') {
        for (const [key, value] of Object.entries(target)) {
            if (key === condition || key === 'default') return conditionTarget(value, condition);
        }
    }
    return null;
}

function hasCondition(target, condition) {
    if (Array.isArray(target)) return target.some((t) => hasCondition(t, condition));
    if (target && typeof target === 'object')
        return Object.keys(target).some(
            (key) => key === condition || (key !== 'types' && hasCondition(target[key], condition)),
        );
    return false;
}

function nodeImport(spec) {
    return run(
        process.execPath,
        ['--input-type=module', '-e', `await import(${JSON.stringify(spec)})`],
        { cwd: consumeDir },
    );
}

function nodeRequire(spec) {
    return run(process.execPath, ['-e', `require(${JSON.stringify(spec)})`], {
        cwd: consumeDir,
    });
}

function walkFiles(dir, out = [], base = dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walkFiles(full, out, base);
        else out.push(path.relative(base, full));
    }
    return out;
}

const installedDir = path.join(consumeDir, 'node_modules', name);
check(`${name} installed`, existsSync(installedDir));
if (!existsSync(installedDir)) finish();

const pkgType = manifest.type === 'module' ? 'module' : 'commonjs';

// Literal `files` entries must have shipped (a typo there is silent).
for (const entry of manifest.files ?? []) {
    if (/[*!]/.test(entry)) continue;
    check(`${name} ships files entry "${entry}"`, existsSync(path.join(installedDir, entry)));
}

// Collect entry points from the exports map.
const entries = [];
const exportsMap =
    typeof manifest.exports === 'string' ||
    !Object.keys(manifest.exports ?? {}).some((k) => k.startsWith('.'))
        ? { '.': manifest.exports }
        : manifest.exports;
for (const [subpath, target] of Object.entries(exportsMap)) entries.push({ subpath, target });

for (const { subpath, target } of entries) {
    const spec = subpath === '.' ? name : `${name}/${subpath.slice(2)}`;

    if (subpath.includes('*')) {
        // Expand the wildcard against the shipped files and verify each
        // mapped target actually exists in the tarball.
        const targetStr = conditionTarget(target, 'import') ?? '';
        const [prefix, suffix] = targetStr.split('*');
        const baseDir = path.join(installedDir, prefix);
        if (!existsSync(baseDir)) {
            check(
                `${name} exports "${subpath}" base dir ships`,
                false,
                `${prefix} missing from tarball`,
            );
            continue;
        }
        const matches = walkFiles(baseDir).filter((f) => (suffix ? f.endsWith(suffix) : true));
        check(
            `${name} exports "${subpath}" matches shipped files`,
            matches.length > 0,
            `no files under ${prefix}`,
        );
        continue;
    }

    const importTarget = conditionTarget(target, 'import');
    const requireTarget = conditionTarget(target, 'require');
    const isJs = (p) => p && /\.(mjs|cjs|js)$/.test(p);
    const isJson = (p) => p && p.endsWith('.json');

    if (isJs(importTarget)) {
        const res = nodeImport(spec);
        check(`import "${spec}"`, res.status === 0, res.stderr);
    } else if (importTarget && !isJson(importTarget)) {
        // Data export (yaml, css, ...): the file must ship.
        check(
            `${spec} data export ships (${importTarget})`,
            existsSync(path.join(installedDir, importTarget)),
        );
    }

    const requireable =
        isJson(requireTarget) ||
        (isJs(requireTarget) &&
            (hasCondition(target, 'require') ||
                requireTarget.endsWith('.cjs') ||
                (requireTarget.endsWith('.js') && pkgType === 'commonjs')));
    if (requireable) {
        const res = nodeRequire(spec);
        check(`require "${spec}"`, res.status === 0, res.stderr);
    }
}

// 4. no dangling source maps

// `files` excludes `dist/**/*.map`, so a build that still emits the comment
// leaves every shipped chunk and declaration pointing at a file the consumer
// does not have. Cheap to check here, invisible everywhere else.
const dangling = [];
for (const relative of walkFiles(installedDir)) {
    if (!/\.(mjs|cjs|js|ts)$/.test(relative)) continue;
    const contents = readFileSync(path.join(installedDir, relative), 'utf8');
    const reference = /\/\/#\s*sourceMappingURL=(\S+)/.exec(contents);
    if (!reference) continue;
    const mapPath = path.resolve(path.dirname(path.join(installedDir, relative)), reference[1]);
    if (!existsSync(mapPath)) dangling.push(`${relative} -> ${reference[1]}`);
}
check(
    `${name} ships no reference to a source map it leaves out`,
    dangling.length === 0,
    dangling.join('\n'),
);

typecheckDeclarations(entries);

finish();

// 5. published type surface

// Type-check every typed entry point from the scratch project. This runs with
// `skipLibCheck: false` on purpose: TypeScript reports a dangling triple-slash
// reference or a missing declaration inside a dependency only when lib checking
// is on, and most consumers ship with it off, so a broken published .d.ts can
// sit there unnoticed. Compiling the consumer's own file, not the package's, is
// what a real integrator does.
function typecheckDeclarations(declared) {
    const typedSpecs = [];
    for (const { subpath, target } of declared) {
        if (subpath.includes('*')) continue;
        if (!conditionTarget(target, 'types')) continue;
        typedSpecs.push(subpath === '.' ? name : `${name}/${subpath.slice(2)}`);
    }
    if (typedSpecs.length === 0) return;

    const tsc = path.join(REPO_ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
    check(`typescript available to type-check ${name}`, existsSync(tsc), `missing ${tsc}`);
    if (!existsSync(tsc)) return;

    const probeName = `types-probe-${name.replace(/[^a-z0-9]+/gi, '-')}`;
    writeFileSync(
        path.join(consumeDir, `${probeName}.ts`),
        typedSpecs.map((spec, i) => `import type * as m${i} from '${spec}';\n`).join('') +
            `export type Probe = [${typedSpecs.map((_, i) => `typeof m${i}`).join(', ')}];\n`,
    );
    const tsconfigPath = path.join(consumeDir, `${probeName}.tsconfig.json`);
    writeFileSync(
        tsconfigPath,
        JSON.stringify(
            {
                compilerOptions: {
                    module: 'esnext',
                    moduleResolution: 'bundler',
                    target: 'es2022',
                    strict: true,
                    noEmit: true,
                    skipLibCheck: false,
                    types: [],
                },
                include: [`${probeName}.ts`],
            },
            null,
            2,
        ),
    );
    const res = run(process.execPath, [tsc, '-p', tsconfigPath], { cwd: consumeDir });
    check(
        `${name} published declarations type-check (skipLibCheck: false)`,
        res.status === 0,
        res.stdout || res.stderr,
    );
}

function finish() {
    if (keep) console.log(`[pack-consume] scratch kept at ${scratch}`);
    else rmSync(scratch, { recursive: true, force: true });

    if (failures.length > 0) {
        console.error(`\n[pack-consume] ${failures.length} of ${checks} checks failed.`);
        process.exit(1);
    }
    console.log(`[pack-consume] all ${checks} checks passed for ${name}.`);
    process.exit(0);
}
