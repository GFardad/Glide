import { describe, it, expect, beforeEach } from "vitest";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { HeadroomRuntime } from "../packages/headroom/src/runtime.js";

/**
 * Coverage tests for packages/headroom/src/runtime.ts.
 * Directly exercises initialize, applyDelta, rollback, and snapshot loading.
 */

const TMP = "/tmp/glide-runtime-coverage-test";

beforeEach(() => {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true });
  mkdirSync(TMP, { recursive: true });
});

describe("HeadroomRuntime", () => {
  it("initializes a runtime and persists an initial snapshot", async () => {
    const runtime = new HeadroomRuntime(TMP);
    const state = await runtime.initialize("Build CLI");
    expect(state.campaign.goal).toBe("Build CLI");
    expect(state.snapshot).toBeDefined();
    expect(state.snapshot!.state).toHaveLength(1);
  });

  it("reuses an existing campaign when initializing again", async () => {
    const runtime = new HeadroomRuntime(TMP);
    await runtime.initialize("Original goal");
    const state = await runtime.initialize("Original goal");
    expect(state.campaign.goal).toBe("Original goal");
  });

  it("applies a delta and returns a new snapshot", async () => {
    const runtime = new HeadroomRuntime(TMP);
    await runtime.initialize("Build CLI");
    const snapshot = runtime.applyDelta({
      timestamp: new Date().toISOString(),
      evidence: "Add new goal",
      operations: [
        {
          kind: "add",
          goalId: "new-goal",
          goal: "New goal",
          campaignId: "camp-1",
        },
      ],
    });
    expect(snapshot.state).toHaveLength(2);
    expect(snapshot.state[1]?.id).toBe("new-goal");
    expect(snapshot.deltaHistory).toHaveLength(1);
  });

  it("rolls back to a previous snapshot by id", async () => {
    const runtime = new HeadroomRuntime(TMP);
    await runtime.initialize("Build CLI");
    const after = runtime.applyDelta({
      timestamp: new Date().toISOString(),
      evidence: "Evolve",
      operations: [
        {
          kind: "add",
          goalId: "evolved",
          goal: "Evolved goal",
        },
      ],
    });

    const rolled = runtime.rollback(after.id);
    expect(rolled.id).toBe(after.id);
    expect(rolled.state).toHaveLength(2);
  });

  it("throws when rolling back to an unknown snapshot id", () => {
    const runtime = new HeadroomRuntime(TMP);
    expect(() => runtime.rollback("missing")).toThrow("Snapshot not found:");
  });

  it("loads the latest snapshot from history", async () => {
    const runtime = new HeadroomRuntime(TMP);
    await runtime.initialize("Build CLI");
    const first = runtime.loadLatestSnapshot();
    expect(first?.id).toBeDefined();
    const snapshot = runtime.applyDelta({
      timestamp: new Date().toISOString(),
      evidence: "Update",
      operations: [
        {
          kind: "update",
          goalId: first!.state[0]!.id,
          goal: "Updated goal",
        },
      ],
    });
    const latest = runtime.loadLatestSnapshot();
    expect(latest?.id).toBe(snapshot.id);
  });
});
