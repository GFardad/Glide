import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, } from "node:fs";
import { join } from "node:path";
const DEFAULT_POLICY = {
    allowedActions: ["read", "write_notes", "mark_todo", "record_rejection"],
    blockedActions: ["delete", "exec", "network", "filesystem_root"],
    requireApproval: ["exec", "network", "filesystem_root"],
};
export function loadPolicy(workspace) {
    const path = join(workspace, "permissions", "policy.json");
    if (!existsSync(path)) {
        mkdirSync(join(workspace, "permissions"), { recursive: true });
        writeFileSync(path, JSON.stringify(DEFAULT_POLICY, null, 2));
        return DEFAULT_POLICY;
    }
    return JSON.parse(readFileSync(path, "utf8"));
}
export function requestPermission(workspace, request) {
    const id = `perm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date();
    const full = {
        ...request,
        id,
        status: "pending",
        createdAt: now,
    };
    const requestsDir = join(workspace, "permissions", "requests");
    mkdirSync(requestsDir, { recursive: true });
    writeFileSync(join(requestsDir, `${id}.json`), JSON.stringify(full, null, 2));
    return full;
}
export function approvePermission(workspace, id, decidedBy = "cto") {
    const path = join(workspace, "permissions", "requests", `${id}.json`);
    if (!existsSync(path))
        return null;
    const request = JSON.parse(readFileSync(path, "utf8"));
    request.status = "approved";
    request.decidedAt = new Date();
    request.decidedBy = decidedBy;
    writeFileSync(path, JSON.stringify(request, null, 2));
    return request;
}
export function rejectPermission(workspace, id, decidedBy = "cto") {
    const path = join(workspace, "permissions", "requests", `${id}.json`);
    if (!existsSync(path))
        return null;
    const request = JSON.parse(readFileSync(path, "utf8"));
    request.status = "rejected";
    request.decidedAt = new Date();
    request.decidedBy = decidedBy;
    writeFileSync(path, JSON.stringify(request, null, 2));
    return request;
}
export function checkPermission(workspace, agentId, action) {
    const policy = loadPolicy(workspace);
    if (policy.blockedActions.includes(action)) {
        return { allowed: false, requiresApproval: false };
    }
    if (policy.allowedActions.includes(action)) {
        return { allowed: true, requiresApproval: false };
    }
    return {
        allowed: true,
        requiresApproval: policy.requireApproval.includes(action),
    };
}
export function listPendingPermissions(workspace) {
    const requestsDir = join(workspace, "permissions", "requests");
    if (!existsSync(requestsDir))
        return [];
    const pending = [];
    for (const entry of readdirSync(requestsDir)) {
        if (!entry.endsWith(".json"))
            continue;
        const request = JSON.parse(readFileSync(join(requestsDir, entry), "utf8"));
        if (request.status === "pending")
            pending.push(request);
    }
    return pending.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}
//# sourceMappingURL=permissions.js.map