export interface CommandGuardOptions {
    allowedWorkspaceRoots?: string[];
    allowedCommands?: string[];
    allowedArguments?: string[];
}
export declare class CommandGuardError extends Error {
    readonly code: "COMMAND_NOT_ALLOWED" | "CWD_OUTSIDE_WORKSPACE" | "INVALID_COMMAND" | "ARGUMENT_NOT_ALLOWED";
    readonly cause?: unknown | undefined;
    constructor(code: "COMMAND_NOT_ALLOWED" | "CWD_OUTSIDE_WORKSPACE" | "INVALID_COMMAND" | "ARGUMENT_NOT_ALLOWED", message: string, cause?: unknown | undefined);
}
export declare function sanitizeWorkspacePath(candidate: string, allowedRoots: string[]): string;
export declare function parseCommandString(command: string): {
    command: string;
    args: string[];
};
export declare function validateArgument(arg: string, allowedArguments: Set<string>): void;
export declare function runAllowedCommand(command: string, cwd: string, options?: CommandGuardOptions): string;
//# sourceMappingURL=command-guard.d.ts.map