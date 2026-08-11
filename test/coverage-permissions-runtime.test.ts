import { describe, it, expect, beforeEach } from "vitest";
import {
  existsSync,
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  loadPolicy,
  requestPermission,
  approvePermission,
  rejectPermission,
  checkPermission,
  listPendingPermissions,
} from "../packages/permissions/src/permissions.js";

/**
 * Coverage gap tests for packages/permissions/src/permissions.ts (policy +
 * request lifecycle). These complement test/permissions.test.ts, which only
 * exercises the runtime.js authorize/createSubject API.
 */
describe("permissions policy runtime", () => {
  const tmpRoot = "/tmp/glide-permissions-src-test";

  beforeEach(() => {
    if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true });
    mkdirSync(tmpRoot, { recursive: true });
  });

  it("creates a default policy file when none exists", () => {
    const ws = join(tmpRoot, "ws-default");
    const policy = loadPolicy(ws);

    expect(policy.allowedActions).toContain("read");
    expect(policy.blockedActions).toContain("delete");
    expect(policy.requireApproval).toContain("exec");
    expect(existsSync(join(ws, "permissions", "policy.json"))).toBe(true);
    expect(
      JSON.parse(readFileSync(join(ws, "permissions", "policy.json"), "utf8"))
    ).toEqual(policy);
  });

  it("loads an existing policy file", () => {
    const ws = join(tmpRoot, "ws-existing");
    const dir = join(ws, "permissions");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "policy.json"),
      JSON.stringify({
        allowedActions: ["read"],
        blockedActions: ["delete"],
        requireApproval: [],
      })
    );

    const policy = loadPolicy(ws);
    expect(policy.allowedActions).toEqual(["read"]);
    expect(policy.blockedActions).toEqual(["delete"]);
  });

  it("requests permission and writes a pending request file", () => {
    const ws = join(tmpRoot, "ws-request");
    const request = requestPermission(ws, {
      agentId: "agent-1",
      action: "exec",
      reason: "needs to run build",
    });

    expect(request.status).toBe("pending");
    expect(request.id).toMatch(/^perm_/);
    expect(request.createdAt).toBeInstanceOf(Date);
    expect(
      existsSync(join(ws, "permissions", "requests", `${request.id}.json`))
    ).toBe(true);
  });

  it("approves a pending request", () => {
    const ws = join(tmpRoot, "ws-approve");
    const request = requestPermission(ws, {
      agentId: "agent-1",
      action: "exec",
      reason: "build",
    });

    const approved = approvePermission(ws, request.id, "cto");
    expect(approved).not.toBeNull();
    expect(approved?.status).toBe("approved");
    expect(approved?.decidedBy).toBe("cto");
    expect(approved?.decidedAt).toBeInstanceOf(Date);

    // Persisted state reflects the decision.
    const persisted = JSON.parse(
      readFileSync(
        join(ws, "permissions", "requests", `${request.id}.json`),
        "utf8"
      )
    );
    expect(persisted.status).toBe("approved");
  });

  it("returns null when approving an unknown request", () => {
    const ws = join(tmpRoot, "ws-approve-missing");
    expect(approvePermission(ws, "perm_does_not_exist")).toBeNull();
  });

  it("rejects a pending request with a custom decider", () => {
    const ws = join(tmpRoot, "ws-reject");
    const request = requestPermission(ws, {
      agentId: "agent-1",
      action: "network",
      reason: "fetch",
    });

    const rejected = rejectPermission(ws, request.id, "lead");
    expect(rejected?.status).toBe("rejected");
    expect(rejected?.decidedBy).toBe("lead");
    expect(rejected?.decidedAt).toBeInstanceOf(Date);
  });

  it("returns null when rejecting an unknown request", () => {
    const ws = join(tmpRoot, "ws-reject-missing");
    expect(rejectPermission(ws, "perm_missing")).toBeNull();
  });

  it("blocks actions listed in blockedActions", () => {
    const ws = join(tmpRoot, "ws-check-blocked");
    const result = checkPermission(ws, "agent-1", "delete");
    expect(result).toEqual({ allowed: false, requiresApproval: false });
  });

  it("allows actions in allowedActions without approval", () => {
    const ws = join(tmpRoot, "ws-check-allowed");
    const result = checkPermission(ws, "agent-1", "read");
    expect(result).toEqual({ allowed: true, requiresApproval: false });
  });

  it("flags unknown actions that require approval when policy says so", () => {
    const ws = join(tmpRoot, "ws-check-approval");
    // Default policy blocks exec outright; write a custom policy that puts a
    // non-blocked action on the approval list to reach the approval branch.
    const dir = join(ws, "permissions");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "policy.json"),
      JSON.stringify({
        allowedActions: ["read"],
        blockedActions: ["delete"],
        requireApproval: ["ssh"],
      })
    );
    const result = checkPermission(ws, "agent-1", "ssh");
    expect(result).toEqual({ allowed: true, requiresApproval: true });
  });

  it("allows unknown actions not requiring approval", () => {
    const ws = join(tmpRoot, "ws-check-unknown");
    // "ssh" is not in any list → allowed without approval.
    const result = checkPermission(ws, "agent-1", "ssh");
    expect(result).toEqual({ allowed: true, requiresApproval: false });
  });

  it("lists pending requests sorted by creation time", async () => {
    const ws = join(tmpRoot, "ws-pending");
    const first = requestPermission(ws, {
      agentId: "a",
      action: "exec",
      reason: "one",
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = requestPermission(ws, {
      agentId: "b",
      action: "exec",
      reason: "two",
    });

    // Approve the second so only the first remains pending.
    approvePermission(ws, second.id);

    const pending = listPendingPermissions(ws);
    expect(pending.map((p) => p.id)).toEqual([first.id]);
  });

  it("returns an empty list when no requests directory exists", () => {
    const ws = join(tmpRoot, "ws-no-requests");
    expect(listPendingPermissions(ws)).toEqual([]);
  });

  it("ignores non-json and non-pending entries when listing", () => {
    const ws = join(tmpRoot, "ws-mixed");
    const approved = requestPermission(ws, {
      agentId: "a",
      action: "exec",
      reason: "done",
    });
    approvePermission(ws, approved.id);
    writeFileSync(
      join(ws, "permissions", "requests", "README.txt"),
      "not json"
    );

    const pending = listPendingPermissions(ws);
    expect(pending).toEqual([]);
  });
});
