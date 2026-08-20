export interface ResolvedPath {
    absolute: string;
    relative: string;
    root: string;
}
export interface PathGuardOptions {
    /** Allowed root directories. The resolved path must be within at least one. */
    allowedRoots: string[];
    /** If true, reject paths that resolve to symlinks outside allowed roots. Default: true. */
    rejectSymlinksOutsideRoots?: boolean;
    /** If true, reject paths that do not exist on disk. Default: false. */
    requireExists?: boolean;
}
export declare class PathGuardError extends Error {
    readonly code: "TRAVERSAL_DETECTED" | "SYMLINK_OUTSIDE_ROOT" | "PATH_NOT_FOUND" | "INVALID_PATH";
    readonly cause?: unknown | undefined;
    constructor(code: "TRAVERSAL_DETECTED" | "SYMLINK_OUTSIDE_ROOT" | "PATH_NOT_FOUND" | "INVALID_PATH", message: string, cause?: unknown | undefined);
}
export declare function resolveAndValidatePath(userPath: string, options: PathGuardOptions): ResolvedPath;
export declare function createPathGuard(options: PathGuardOptions): (userPath: string) => ResolvedPath;
//# sourceMappingURL=path-guard.d.ts.map