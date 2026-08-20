export interface PermissionSubject {
    id: string;
    role: string;
    scopes: string[];
}
export interface PermissionAction {
    action: string;
    resource: string;
}
export interface PermissionRuntimeOptions {
    allowedActions?: string[];
    actionScopes?: Map<string, string>;
}
export declare class PermissionRuntime {
    private readonly allowedActions;
    private readonly actionScopes;
    constructor(options?: PermissionRuntimeOptions);
    createSubject(role: string, scopes: string[]): PermissionSubject;
    authorize(subject: PermissionSubject, action: PermissionAction): {
        ok: boolean;
        reason?: string;
    };
}
export declare function createSubject(role: string, scopes: string[]): PermissionSubject;
export declare function authorize(subject: PermissionSubject, action: PermissionAction): {
    ok: boolean;
    reason?: string;
};
//# sourceMappingURL=runtime.d.ts.map