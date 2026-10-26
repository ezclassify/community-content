/**
 * Lockfile helpers shared by the dependency gates and the SBOM generator.
 *
 * Four scripts read `package-lock.json` for the same reason: to learn what an
 * install actually resolves. They agree on how a lockfile key names a package,
 * so that rule lives here once instead of drifting between copies.
 * @module
 */

/**
 * Recover a package name from a lockfile path such as
 * `node_modules/a/node_modules/@scope/b`. The last `node_modules/` segment
 * wins, so a nested copy reports its own name rather than its parent's.
 *
 * @param {string} lockPath - Key of an entry in the lockfile's `packages` map.
 * @returns {string | null} The package name, or null when the key is not an
 *   installed-package path.
 */
export function nameFromLockfilePath(lockPath) {
    const marker = 'node_modules/';
    const index = lockPath.lastIndexOf(marker);
    if (index < 0) return null;
    return lockPath.slice(index + marker.length);
}
