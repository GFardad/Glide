import { describe, it, expect, beforeEach } from "vitest";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  HeartbeatService,
} from "../packages/headroom/src/heartbeat.js";
import { persistGoal, resetGoalStoreCache } from "../packages/headroom/src/goal-store.js";

const TMP = "/tmp/glide-heartbeat-coverage-test";

describe("headroom heartbeat coverage gaps", () => {
  beforeEach(() => {
    if (existsSync(TMP)) rmSync(TMP, { recursive: true });
    mkdirSync(TMP, { recursive: true });
    resetGoalStoreCache();
  });

  it("parses ISO 8601 durations to milliseconds via runScheduledGoals", async () => {
    const root = join(TMP, "duration");
    mkdirSync(root, { recursive: true });

    const created = new Date("2025-01-01T00:00:00.000Z");
    const updated = new Date(Date.now() - 3600000);
    const goal = {
      id: "duration-1",
      goal: "Duration task",
      status: "scheduled" as const,
      createdAt: created,
      updatedAt: updated,
      metadata: {
        scheduleExpression: "PT1H",
        lastScheduledAt: new Date(Date.now() - 3600000).toISOString(),
      },
    };

    await persistGoal({ root }, goal);

    const service = new HeartbeatService({ root, intervalMs: 0 });
    const result = await service.runScheduledGoals({
      root,
      expression: "PT1H",
      onSchedule: () => {},
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("duration-1");
    expect(result[0].status).toBe("active");
  });

  it("persists and loads heartbeat state", async () => {
    const service = new HeartbeatService({ root: TMP, intervalMs: 50, maxIterations: 1 });
    service.start();
    await new Promise((resolve) => setTimeout(resolve, 100));
    service.stop();

    const state = service.loadHeartbeatState();
    expect(state?.iteration).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(state?.activeGoals)).toBe(true);
  });

  it("returns undefined when no heartbeat state file exists", () => {
    const service = new HeartbeatService({ root: join(TMP, "missing"), intervalMs: 0 });
    expect(service.loadHeartbeatState()).toBeUndefined();
  });

  it("runs scheduled goals by expression and calls onSchedule", async () => {
    const root = join(TMP, "campaign");
    mkdirSync(root, { recursive: true });

    const created = new Date("2025-01-01T00:00:00.000Z");
    const updated = new Date(Date.now() - 3600000);
    const goal = {
      id: "scheduled-1",
      goal: "Scheduled task",
      status: "scheduled" as const,
      createdAt: created,
      updatedAt: updated,
      metadata: {
        scheduleExpression: "PT1H",
        lastScheduledAt: new Date(Date.now() - 3600000).toISOString(),
      },
    };

    await persistGoal({ root }, goal);

    const scheduled: string[] = [];
    const service = new HeartbeatService({ root, intervalMs: 0 });
    const result = await service.runScheduledGoals({
      root,
      expression: "PT1H",
      onSchedule: (records) => {
        scheduled.push(...records.map((r) => r.id));
      },
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("scheduled-1");
    expect(result[0].status).toBe("active");
    expect(scheduled).toContain("scheduled-1");
  });

  it("runs scheduled goals without expression using interval", async () => {
    const root = join(TMP, "campaign2");
    mkdirSync(root, { recursive: true });

    const created = new Date("2025-01-01T00:00:00.000Z");
    const updated = new Date(Date.now() - 100000);
    const goal = {
      id: "due-1",
      goal: "Due task",
      status: "scheduled" as const,
      createdAt: created,
      updatedAt: updated,
    };

    await persistGoal({ root }, goal);

    const service = new HeartbeatService({ root, intervalMs: 0 });
    const result = await service.runScheduledGoals({
      root,
      intervalMs: 50000,
      onSchedule: () => {},
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("due-1");
  });

  it("returns empty array when no scheduled goals match", async () => {
    const root = join(TMP, "empty");
    mkdirSync(root, { recursive: true });

    const service = new HeartbeatService({ root, intervalMs: 0 });
    const result = await service.runScheduledGoals({
      root,
      expression: "PT1H",
      onSchedule: () => {},
    });

    expect(result).toEqual([]);
  });

  it("starts and stops a heartbeat", async () => {
    const root = join(TMP, "hb");
    mkdirSync(root, { recursive: true });

    const ticks: number[] = [];
    const service = new HeartbeatService({
      root,
      intervalMs: 50,
      maxIterations: 3,
      onTick: async () => {
        ticks.push(1);
      },
    });
    const stop = () => service.stop();
    service.start();

    // Wait for a few ticks
    await new Promise((resolve) => setTimeout(resolve, 200));
    stop();

    expect(ticks.length).toBeGreaterThanOrEqual(1);
    expect(ticks.length).toBeLessThanOrEqual(3);
  });

  it("heartbeat persists state on each tick", async () => {
    const root = join(TMP, "hb-state");
    mkdirSync(root, { recursive: true });

    const service = new HeartbeatService({
      root,
      intervalMs: 50,
      maxIterations: 2,
      onTick: async () => {},
    });
    const stop = () => service.stop();
    service.start();

    await new Promise((resolve) => setTimeout(resolve, 150));
    stop();

    const state = service.loadHeartbeatState();
    expect(state?.iteration).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(state?.activeGoals)).toBe(true);
  });
});
