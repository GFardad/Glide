import { existsSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
export class PathGuardError extends Error {
    code;
    cause;
    constructor(code, message, cause) {
        super(message);
        this.code = code;
        this.cause = cause;
        this.name = "PathGuardError";
    }
}
function normalizeRoot(root) {
    const resolved = resolve(root);
    return resolved.endsWith(sep) ? resolved : resolved + sep;
}
function isWithinRoot(candidate, root) {
    const candidateWithSep = candidate.endsWith(sep) ? candidate : candidate + sep;
    const normalizedRoot = root.endsWith(sep) ? root : root + sep;
    return candidateWithSep === normalizedRoot || candidateWithSep.startsWith(normalizedRoot);
}
function checkSymlinkPath(pathToCheck, allowedRoots) {
    const segments = pathToCheck.split(sep).filter(Boolean);
    let current = sep;
    for (const segment of segments) {
        current = join(current, segment);
        try {
            const stats = statSync(current);
            if (stats.isSymbolicLink()) {
                const resolved = realpathSync(current);
                if (!allowedRoots.some((root) => isWithinRoot(resolved, root))) {
                    throw new PathGuardError("SYMLINK_OUTSIDE_ROOT", `Symlink at "${current}" resolves to "${resolved}", which is outside allowed roots`);
                }
            }
        }
        catch (error) {
            if (error instanceof PathGuardError) {
                throw error;
            }
            // Ignore only ENOENT (intermediate directory not yet created);
            // re-throw permission/timeout/transient FS errors so they are not
            // silently masked during a security check.
            const code = error.code;
            if (code !== "ENOENT") {
                throw error;
            }
        }
    }
}
export function resolveAndValidatePath(userPath, options) {
    if (typeof userPath !== "string" || userPath.trim().length === 0) {
        throw new PathGuardError("INVALID_PATH", "Path must be a non-empty string");
    }
    const absolute = resolve(userPath);
    const normalizedRoots = options.allowedRoots.map(normalizeRoot);
    if (!isAbsolute(userPath)) {
        throw new PathGuardError("INVALID_PATH", `Path must be absolute; received "${userPath}"`);
    }
    if (options.requireExists && !existsSync(absolute)) {
        throw new PathGuardError("PATH_NOT_FOUND", `Path does not exist: ${absolute}`);
    }
    const withinAnyRoot = normalizedRoots.some((root) => isWithinRoot(absolute, root));
    if (!withinAnyRoot) {
        throw new PathGuardError("TRAVERSAL_DETECTED", `Resolved path "${absolute}" is outside all allowed roots: ${options.allowedRoots.join(", ")}`);
    }
    if (options.rejectSymlinksOutsideRoots !== false) {
        checkSymlinkPath(absolute, normalizedRoots);
    }
    const root = normalizedRoots[0];
    const rel = relative(root, absolute);
    return { absolute, relative: rel.startsWith("..") ? absolute : rel, root };
}
export function createPathGuard(options) {
    return (userPath) => resolveAndValidatePath(userPath, options);
}
//# sourceMappingURL=path-guard.js.map