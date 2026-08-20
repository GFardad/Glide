export interface PermissionRequest {
    id: string;
    agentId: string;
    action: string;
    reason: string;
    status: "pending" | "approved" | "rejected";
    createdAt: Date;
    decidedAt?: Date;
    decidedBy?: string;
}
export interface PermissionPolicy {
    allowedActions: string[];
    blockedActions: string[];
    requireApproval: string[];
}
export declare function loadPolicy(workspace: string): PermissionPolicy;
export declare function requestPermission(workspace: string, request: Omit<PermissionRequest, "id" | "status" | "createdAt">): PermissionRequest;
export declare function approvePermission(workspace: string, id: string, decidedBy?: string): PermissionRequest | null;
export declare function rejectPermission(workspace: string, id: string, decidedBy?: string): PermissionRequest | null;
export declare function checkPermission(workspace: string, agentId: string, action: string): {
    allowed: boolean;
    requiresApproval: boolean;
};
export declare function listPendingPermissions(workspace: string): PermissionRequest[];
//# sourceMappingURL=permissions.d.ts.map