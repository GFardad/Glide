import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { GoalRecord, GoalStatus } from "@glide/core";
import type { GoalStoreOptions } from "./goal-store.js";
import {
  loadGoal,
  loadAllGoals,
  persistGoal,
} from "./goal-store.js";

export interface HeartbeatOptions extends GoalStoreOptions {
  intervalMs: number;
  maxIterations?: number;
  onTick?: (activeGoals: GoalRecord[]) => Promise<void> | void;
}

export interface ScheduleOptions extends GoalStoreOptions {
  expression?: string;
  intervalMs?: number;
  onSchedule?: (records: GoalRecord[]) => Promise<void> | void;
}

export interface HeartbeatServiceOptions extends HeartbeatOptions {
  root: string;
}

export class HeartbeatService {
  private readonly options: HeartbeatOptions;
  private timer: ReturnType<typeof setInterval> | undefined;
  private iteration = 0;
  private stopped = true;

  constructor(options: HeartbeatServiceOptions) {
    this.options = options;
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.iteration = 0;
    this.tick();
    this.timer = setInterval(() => this.tick(), this.options.intervalMs);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  isRunning(): boolean {
    return !this.stopped;
  }

  async tick(): Promise<void> {
    if (this.stopped) return;
    if (typeof this.options.maxIterations === "number" && this.iteration >= this.options.maxIterations) {
      this.stop();
      return;
    }

    const activeGoals = await this.loadActiveGoals();
    if (typeof this.options.onTick === "function") {
      await this.options.onTick(activeGoals);
    }

    this.iteration += 1;

    this.persistHeartbeatState({
      iteration: this.iteration,
      activeGoals: activeGoals.map((goal) => goal.id),
      lastTickAt: new Date().toISOString(),
    });
  }

  async runScheduledGoals(options: ScheduleOptions): Promise<GoalRecord[]> {
    const { expression } = options;
    const intervalMs = options.intervalMs ?? 0;
    const now = new Date();
    const candidates = expression
      ? await this.matchScheduledGoals(options, now)
      : await this.loadDueGoals(options, intervalMs);

    if (candidates.length === 0) {
      return [];
    }

    const reentered = candidates.map((record) => ({
      ...record,
      status: "active" as GoalStatus,
      updatedAt: now,
      metadata: {
        ...(record.metadata ?? {}),
        lastScheduledAt: now.toISOString(),
      },
    }));

    for (const record of reentered) {
      await persistGoal(options, record);
    }

    if (typeof options.onSchedule === "function") {
      await options.onSchedule(reentered);
    }

    return reentered;
  }

  loadHeartbeatState(): { iteration: number; activeGoals: string[]; lastTickAt: string } | undefined {
    const path = join(this.options.root, "heartbeat-state.json");
    if (!existsSync(path)) {
      return undefined;
    }

    return JSON.parse(readFileSync(path, "utf8"));
  }

  private async loadActiveGoals(): Promise<GoalRecord[]> {
    const state = this.loadHeartbeatState();
    if (!state || state.activeGoals.length === 0) {
      return [];
    }

    const loaded = await Promise.all(
      state.activeGoals.map((id) => loadGoal(this.options, id))
    );

    return loaded.filter((record): record is GoalRecord => Boolean(record && record.status === "active"));
  }

  private async matchScheduledGoals(options: ScheduleOptions, now: Date): Promise<GoalRecord[]> {
    const allGoals = await loadAllGoals(options);
    return allGoals.filter((record) => {
      const metadata = record.metadata ?? {};
      const schedule = metadata.scheduleExpression as string | undefined;
      const lastScheduled = metadata.lastScheduledAt as string | undefined;

      if (!schedule || schedule !== options.expression) {
        return false;
      }

      if (!lastScheduled) {
        return true;
      }

      const lastDate = new Date(lastScheduled);
      const diffMs = now.getTime() - lastDate.getTime();
      return diffMs >= parseDurationToMs(options.expression, diffMs);
    });
  }

  private async loadDueGoals(options: GoalStoreOptions, intervalMs: number): Promise<GoalRecord[]> {
    const allGoals = await loadAllGoals(options);
    const now = Date.now();
    return allGoals.filter((record) => {
      const updatedAt = record.updatedAt.getTime();
      return record.status === "scheduled" && now - updatedAt >= intervalMs;
    });
  }

  private persistHeartbeatState(
    state: { iteration: number; activeGoals: string[]; lastTickAt: string }
  ): void {
    const path = join(this.options.root, "heartbeat-state.json");
    writeFileSync(path, JSON.stringify(state, null, 2), "utf-8");
  }
}

function parseDurationToMs(expression: string, fallbackMs: number): number {
  const match = expression.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) return fallbackMs;

  const value = Number(match[1]);
  const unit = match[2];

  switch (unit) {
    case "ms":
      return value;
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      return fallbackMs;
  }
}
