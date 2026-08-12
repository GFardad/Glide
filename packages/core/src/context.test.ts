import { describe, it, expect } from "vitest";
import { createAgentContext, ensureAgentContract, loadAgentContract, validateAgentContract } from "./contract.js";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { AgentFileContractSchema } from "./contract.js";

describe("contract", () => {
  const workspace = join("/tmp", "glide-contract-test", String(Date.now()));
  const sessionId = "session_test_session_000000000000000000000";
  const agentId = "agent_test_agent_00000000000000000000";

  it("createAgentContext generates IDs when omitted", () => {
    const ctx = createAgentContext({ cwd: workspace });
    expect(ctx.agentId).toMatch(/^agent_[A-Za-z0-9_-]{22}$/);
    expect(ctx.sessionId).toMatch(/^session_[A-Za-z0-9_-]{22}$/);
  });

  it("createAgentContext preserves provided IDs", () => {
    const ctx = createAgentContext({ cwd: workspace, sessionId, agentId });
    expect(ctx.agentId).toBe(agentId);
    expect(ctx.sessionId).toBe(sessionId);
  });

  it("createAgentContext rejects invalid IDs via Zod", () => {
    expect(() =>
      createAgentContext({ cwd: workspace, agentId: "bad-id", sessionId })
    ).toThrow();
  });

  it("ensureAgentContract creates all required files atomically", () => {
    mkdirSync(workspace, { recursive: true });
    const ctx = createAgentContext({ cwd: workspace, sessionId, agentId });

    ensureAgentContract(workspace, ctx);

    const agentDir = join(workspace, "agents", agentId);
    expect(existsSync(join(agentDir, "PERSONALITY.md"))).toBe(true);
    expect(existsSync(join(agentDir, "GOAL.md"))).toBe(true);
    expect(existsSync(join(agentDir, "NOTES.md"))).toBe(true);
    expect(existsSync(join(agentDir, "TODO.md"))).toBe(true);
    expect(existsSync(join(agentDir, "REJECTED.md"))).toBe(true);
  });

  it("loadAgentContract returns parsed contract", () => {
    const ctx = createAgentContext({ cwd: workspace, sessionId, agentId });
    ensureAgentContract(workspace, ctx);

    const contract = loadAgentContract(workspace, agentId);
    const parsed = AgentFileContractSchema.parse(contract);

    expect(parsed.personality).toContain("Behavior");
    expect(parsed.goal).toContain("Objective");
    expect(parsed.goal).toContain("Acceptance Criteria");
  });

  it("validateAgentContract reports missing files", () => {
    const emptyDir = join(workspace, "empty-agents");
    mkdirSync(emptyDir, { recursive: true });

    const result = validateAgentContract(emptyDir, agentId);
    expect(result.valid).toBe(false);
    expect(result.missing.length).toBeGreaterThan(0);
  });
});
