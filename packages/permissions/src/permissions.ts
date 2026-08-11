import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";

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

const DEFAULT_POLICY: PermissionPolicy = {
  allowedActions: ["read", "write_notes", "mark_todo", "record_rejection"],
  blockedActions: ["delete", "exec", "network", "filesystem_root"],
  requireApproval: ["exec", "network", "filesystem_root"],
};

export function loadPolicy(workspace: string): PermissionPolicy {
  const path = join(workspace, "permissions", "policy.json");
  if (!existsSync(path)) {
    mkdirSync(join(workspace, "permissions"), { recursive: true });
    writeFileSync(path, JSON.stringify(DEFAULT_POLICY, null, 2));
    return DEFAULT_POLICY;
  }
  return JSON.parse(readFileSync(path, "utf8")) as PermissionPolicy;
}

export function requestPermission(
  workspace: string,
  request: Omit<PermissionRequest, "id" | "status" | "createdAt">
): PermissionRequest {
  const id = `perm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date();
  const full: PermissionRequest = {
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

export function approvePermission(
  workspace: string,
  id: string,
  decidedBy = "cto"
): PermissionRequest | null {
  const path = join(workspace, "permissions", "requests", `${id}.json`);
  if (!existsSync(path)) return null;
  const request = JSON.parse(readFileSync(path, "utf8")) as PermissionRequest;
  request.status = "approved";
  request.decidedAt = new Date();
  request.decidedBy = decidedBy;
  writeFileSync(path, JSON.stringify(request, null, 2));
  return request;
}

export function rejectPermission(
  workspace: string,
  id: string,
  decidedBy = "cto"
): PermissionRequest | null {
  const path = join(workspace, "permissions", "requests", `${id}.json`);
  if (!existsSync(path)) return null;
  const request = JSON.parse(readFileSync(path, "utf8")) as PermissionRequest;
  request.status = "rejected";
  request.decidedAt = new Date();
  request.decidedBy = decidedBy;
  writeFileSync(path, JSON.stringify(request, null, 2));
  return request;
}

export function checkPermission(
  workspace: string,
  agentId: string,
  action: string
): { allowed: boolean; requiresApproval: boolean } {
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

export function listPendingPermissions(workspace: string): PermissionRequest[] {
  const requestsDir = join(workspace, "permissions", "requests");
  if (!existsSync(requestsDir)) return [];
  const pending: PermissionRequest[] = [];
  for (const entry of readdirSync(requestsDir)) {
    if (!entry.endsWith(".json")) continue;
    const request = JSON.parse(
      readFileSync(join(requestsDir, entry), "utf8")
    ) as PermissionRequest;
    if (request.status === "pending") pending.push(request);
  }
  return pending.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}
