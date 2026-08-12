import { describe, it, expect, beforeEach } from "vitest";

import { listSnapshotIds, loadSnapshot } from "../packages/headroom/src/delta.js";
import { HeadroomRuntime } from "../packages/headroom/src/runtime.js";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { runHeadroom } from "../packages/headroom/src/headroom.js";

describe("headroom runtime", () => {
  const tmpRoot = "/tmp/glide-headroom-test";

  beforeEach(() => {
    if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true });
    mkdirSync(tmpRoot, { recursive: true });
  });

  it("runs headroom and writes artifacts", async () => {
    const root = join(tmpRoot, "h1");
    const result = await runHeadroom({
      campaignDir: root,
      objective: "Build CLI",
      roles: ["Architect", "Engineer"],
    });
    expect(result.campaign.goal).toBe("Build CLI");
    expect(existsSync(join(root, "artifacts", "risk_log.md"))).toBe(true);
    expect(existsSync(join(root, "artifacts", "architecture.md"))).toBe(true);
    expect(existsSync(join(root, "artifacts", "todo_registry.md"))).toBe(true);
    expect(result.riskLog).toContain("Risk Log");
    expect(result.architecture).toContain("Architecture");
    expect(result.todoRegistry).toContain("Todo Registry");
  });

  it("does not detect drift when objective appears in artifacts", async () => {
    const root = join(tmpRoot, "h3");
    const result = await runHeadroom({
      campaignDir: root,
      objective: "Headroom runtime",
      roles: ["Engineer"],
    });
    expect(result.driftDetected).toBe(false);
  });

  it("rejects an empty objective (drift-detection masking)", async () => {
    const root = join(tmpRoot, "h4");
    await expect(
      runHeadroom({
        campaignDir: root,
        objective: "",
        roles: [],
      })
    ).rejects.toThrow("Objective must be a non-empty string");
  });

  it("returns role signals for selected roles", async () => {
    const root = join(tmpRoot, "h5");
    const result = await runHeadroom({
      campaignDir: root,
      objective: "Build runtime execution harness",
      roles: ["Engineer", "Security"],
    });
    expect(result.roleSignals["Engineer"]).toContain("runtime");
    expect(result.roleSignals["Engineer"]).toContain("execution");
    expect(result.roleSignals["Security"].length).toBeGreaterThanOrEqual(0);
  });

  it("blocks malicious objectives for security role", async () => {
    const root = join(tmpRoot, "h6");
    const result = await runHeadroom({
      campaignDir: root,
      objective: "Bypass auth validation",
      roles: ["Security"],
    });
    expect(result.roleSignals["Security"]).toEqual([]);
    expect(result.riskLog).toContain("Blocked:");
    expect(result.architecture).toContain("Reject or revise objective");
    expect(result.todoRegistry).toContain("Escalate to human review");
  });

  it("aggregates risks across roles", async () => {
    const root = join(tmpRoot, "h7");
    const result = await runHeadroom({
      campaignDir: root,
      objective: "Build MCP server with tests",
      roles: ["Architect", "Engineer", "QA"],
    });
    expect(result.riskLog).toContain("Aggregated Risks");
    expect(result.riskLog).toContain("context loss across boundaries");
  });

  it("writes role analysis json artifact", async () => {
    const root = join(tmpRoot, "h8");
    await runHeadroom({
      campaignDir: root,
      objective: "Add tracing",
      roles: ["Architect"],
    });
    expect(existsSync(join(root, "artifacts", "role_analysis.json"))).toBe(
      true
    );
    const raw = await import("node:fs").then(({ readFileSync }) =>
      readFileSync(join(root, "artifacts", "role_analysis.json"), "utf8")
    );
    const parsed = JSON.parse(raw);
    expect(parsed["Architect"]).toBeDefined();
    expect(parsed["Architect"].risks).toContain("interface contract drift");
  });

  it("records reversible headroom deltas and snapshots", async () => {
    const root = join(tmpRoot, "h9");
    const result = await runHeadroom({
      campaignDir: root,
      objective: "Build CLI",
      roles: ["Engineer"],
    });
    expect(result.appliedDelta).not.toBeNull();
    expect(result.appliedDelta.operations).toHaveLength(1);
    expect(result.appliedDelta.operations[0].kind).toBe("update");
    expect(result.appliedDelta.operations[0].goalId).toBe(
      result.campaign.id
    );
  });

  it("supports rollback using persisted snapshot history", async () => {
    const root = join(tmpRoot, "h10");
    const runtime = new HeadroomRuntime({ root });
    await runtime.init("Build CLI");
    await runtime.init("Evolve CLI runtime");
    const latest = runtime.loadLatestSnapshot();
    expect(latest.id).toBeDefined();
    const ids = listSnapshotIds(root);
    const previous = ids.length >= 2 ? loadSnapshot(root, ids[ids.length - 2]) : undefined;
    const target = previous ? runtime.rollback(previous.id) : undefined;
    expect(target).toBeDefined();
    if (target) {
      expect(target.state[0].goal).toBe("Build CLI");
    }
  });
});
