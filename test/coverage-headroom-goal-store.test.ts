import { describe, it, expect, beforeEach } from "vitest";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  persistGoal,
  loadGoal,
  loadGoalsByCampaign,
  updateGoalStatus,
  loadActiveGoals,
  loadAllGoals,
  writeGoalSnapshot,
  readGoalSnapshot,
  createGoalRecord,
  resetGoalStoreCache,
} from "../packages/headroom/src/goal-store.js";

const TMP = "/tmp/glide-goal-store-coverage-test";

describe("headroom goal-store coverage gaps", () => {
  beforeEach(() => {
    if (existsSync(TMP)) rmSync(TMP, { recursive: true });
    mkdirSync(TMP, { recursive: true });
    resetGoalStoreCache();
  });

  it("creates and loads a goal record", async () => {
    const record = createGoalRecord("Build coverage", {
      id: "goal-1",
      campaignId: "camp-1",
    });
    expect(record.goal).toBe("Build coverage");
    expect(record.status).toBe("active");

    await persistGoal({ root: TMP }, record);
    const loaded = await loadGoal({ root: TMP }, "goal-1");
    expect(loaded?.goal).toBe("Build coverage");
    expect(loaded?.campaignId).toBe("camp-1");
  });

  it("loads goals by campaign", async () => {
    await persistGoal({ root: TMP }, createGoalRecord("Goal A", { id: "ga", campaignId: "c1" }));
    await persistGoal({ root: TMP }, createGoalRecord("Goal B", { id: "gb", campaignId: "c1" }));
    await persistGoal({ root: TMP }, createGoalRecord("Goal C", { id: "gc", campaignId: "c2" }));

    const c1Goals = await loadGoalsByCampaign({ root: TMP }, "c1");
    expect(c1Goals).toHaveLength(2);
    expect(c1Goals.map((g) => g.id).sort()).toEqual(["ga", "gb"]);
  });

  it("updates goal status", async () => {
    await persistGoal({ root: TMP }, createGoalRecord("Old", { id: "update-me" }));
    const updated = await updateGoalStatus({ root: TMP }, "update-me", "completed");
    expect(updated?.status).toBe("completed");
    expect(updated?.updatedAt.getTime()).toBeGreaterThan(0);
  });

  it("returns undefined when updating missing goal", async () => {
    const updated = await updateGoalStatus({ root: TMP }, "missing", "completed");
    expect(updated).toBeUndefined();
  });

  it("loads active goals only", async () => {
    await persistGoal({ root: TMP }, createGoalRecord("Active", { id: "a1", status: "active" }));
    await persistGoal({ root: TMP }, createGoalRecord("Scheduled", { id: "a2", status: "scheduled" }));
    await persistGoal({ root: TMP }, createGoalRecord("Completed", { id: "a3", status: "completed" }));

    const active = await loadActiveGoals({ root: TMP });
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe("a1");
  });

  it("loads all goals", async () => {
    await persistGoal({ root: TMP }, createGoalRecord("A", { id: "all-1" }));
    await persistGoal({ root: TMP }, createGoalRecord("B", { id: "all-2" }));
    const all = await loadAllGoals({ root: TMP });
    expect(all).toHaveLength(2);
  });

  it("writes and reads a snapshot", () => {
    const records = [
      createGoalRecord("Snap A", { id: "s1" }),
      createGoalRecord("Snap B", { id: "s2" }),
    ];
    writeGoalSnapshot({ root: TMP }, records);
    const loaded = readGoalSnapshot({ root: TMP });
    expect(loaded).toHaveLength(2);
    expect(loaded[0].goal).toBe("Snap A");
  });

  it("returns empty snapshot when file missing", () => {
    const loaded = readGoalSnapshot({ root: join(TMP, "missing-dir") });
    expect(loaded).toEqual([]);
  });

  it("creates goal with metadata", () => {
    const metadata = { priority: 1, owner: "alice" };
    const record = createGoalRecord("With meta", {
      id: "meta-1",
      metadata,
    });
    expect(record.metadata?.priority).toBe(1);
    expect(record.metadata?.owner).toBe("alice");
    expect(record.metadata).toEqual(metadata);
  });
});
