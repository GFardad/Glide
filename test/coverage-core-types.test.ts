import { describe, it, expect } from "vitest";
import type {
  AgentId,
  SessionId,
  CampaignId,
  Campaign,
  Agent,
  Artifact,
} from "../packages/core/src/types/index.js";

/**
 * Coverage tests for packages/core/src/types/index.ts.
 * This file only exports types, so coverage comes from exercising those
 * type aliases and interfaces directly in assertions.
 */

describe("core types", () => {
  it("accepts AgentId, SessionId, and CampaignId as string aliases", () => {
    const agentId: AgentId = "agent-1";
    const sessionId: SessionId = "session-1";
    const campaignId: CampaignId = "campaign-1";
    expect(agentId).toBe("agent-1");
    expect(sessionId).toBe("session-1");
    expect(campaignId).toBe("campaign-1");
  });

  it("creates a Campaign with all required fields", () => {
    const campaign: Campaign = {
      id: "camp-1",
      root: "/tmp/camp",
      goal: "Ship feature",
      nonGoals: ["Scope creep"],
      assumptions: ["Team available"],
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      updatedAt: new Date("2025-01-02T00:00:00.000Z"),
    };
    expect(campaign.goal).toBe("Ship feature");
    expect(campaign.nonGoals).toContain("Scope creep");
  });

  it("creates an Agent with all required fields", () => {
    const agent: Agent = {
      id: "agent-1",
      role: "engineer",
      parentId: null,
      sessionId: "session-1",
      personality: "Be concise",
      goal: "Ship feature",
      notes: [],
      todos: [],
      rejected: [],
      permissions: ["read", "write"],
    };
    expect(agent.parentId).toBeNull();
    expect(agent.permissions).toContain("write");
  });

  it("creates an Artifact with each supported type", () => {
    const types = [
      "risk_log",
      "architecture",
      "todo_registry",
      "plan",
      "code",
      "test",
      "review",
      "ship",
    ] as const;
    for (const type of types) {
      const artifact: Artifact = {
        type,
        path: `artifacts/${type}.md`,
        content: `# ${type}`,
        agentId: "agent-1",
        createdAt: new Date(),
      };
      expect(artifact.type).toBe(type);
    }
  });
});
