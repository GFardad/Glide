import { describe, it, expect } from "vitest";
import type { GoalRecord, GoalStatus } from "../packages/core/src/goal.js";

/**
 * Coverage tests for packages/core/src/goal.ts.
 * The file only exports types/type aliases, so coverage comes from exercising
 * those types directly in assertions.
 */

describe("core goal types", () => {
  it("accepts GoalRecord literals with optional fields omitted", () => {
    const record: GoalRecord = {
      id: "goal-1",
      goal: "Ship feature",
      status: "active",
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      updatedAt: new Date("2025-01-01T00:00:00.000Z"),
    };
    expect(record.id).toBe("goal-1");
    expect(record.status).toBe("active");
    expect(record.campaignId).toBeUndefined();
    expect(record.source).toBeUndefined();
    expect(record.metadata).toBeUndefined();
  });

  it("accepts GoalRecord with optional metadata", () => {
    const record: GoalRecord = {
      id: "goal-2",
      goal: "Ship feature",
      status: "completed",
      createdAt: new Date(),
      updatedAt: new Date(),
      campaignId: "camp-1",
      source: "planner",
      metadata: { priority: 1 },
    };
    expect(record.campaignId).toBe("camp-1");
    expect(record.metadata?.priority).toBe(1);
  });

  it("accepts all GoalStatus variants", () => {
    const statuses: GoalStatus[] = [
      "active",
      "scheduled",
      "completed",
      "abandoned",
    ];
    expect(statuses).toHaveLength(4);
    for (const status of statuses) {
      const record: GoalRecord = {
        id: `g-${status}`,
        goal: status,
        status,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(record.status).toBe(status);
    }
  });

  it("requires createdAt and updatedAt on GoalRecord", () => {
    const record: GoalRecord = {
      id: "goal-3",
      goal: "Test",
      status: "scheduled",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(record.createdAt.getTime()).toBeGreaterThan(0);
    expect(record.updatedAt.getTime()).toBeGreaterThan(0);
  });
});
