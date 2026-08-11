import { writeFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { GoalRecord, GoalStatus } from "@glide/core";
import type { GoalStoreOptions } from "./goal-store.js";
import { loadGoal, loadAllGoals, persistGoal } from "./goal-store.js";

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

const HEARTBEAT_STATE_FILE = "heartbeat-state.json";

export function startHeartbeat(options: HeartbeatOptions): () => void {
  const maxIterations = options.maxIterations ?? Infinity;
  let iteration = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  let stopped = false;

  const stop = (): void => {
    stopped = true;
    if (timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };

  const tick = async (): Promise<void> => {
    if (stopped) return;

    iteration += 1;
    if (iteration > maxIterations) {
      stop();
      return;
    }

    const activeGoals = loadActiveGoals(options);
    if (typeof options.onTick === "function") {
      await options.onTick(activeGoals);
    }

    persistHeartbeatState(options.root, {
      iteration,
      activeGoals: activeGoals.map((record) => record.id),
      lastTickAt: new Date().toISOString(),
    });
  };

  timer = setInterval(tick, options.intervalMs);
  return stop;
}

export function runScheduledGoals(options: ScheduleOptions): GoalRecord[] {
  const { expression } = options;
  const intervalMs = options.intervalMs ?? 0;
  const now = new Date();
  const candidates = expression
    ? matchScheduledGoals(options, now)
    : loadDueGoals(options, intervalMs);

  if (candidates.length === 0) {
    return [];
  }

  const reentered = candidates.map((record) => ({
    ...record,
    status: "active" as GoalStatus,
    updatedAt: now,
    metadata: {
      ...record.metadata,
      lastScheduledAt: now.toISOString(),
      scheduleExpression: expression ?? null,
    },
  }));

  for (const record of reentered) {
    persistGoal(options, record);
  }

  if (typeof options.onSchedule === "function") {
    options.onSchedule(reentered);
  }

  return reentered;
}

export function loadHeartbeatState(root: string): { iteration: number; activeGoals: string[]; lastTickAt: string } | undefined {
  const path = join(root, HEARTBEAT_STATE_FILE);
  if (!existsSync(path)) {
    return undefined;
  }

  return JSON.parse(readFileSync(path, "utf8"));
}

export function persistHeartbeatState(root: string, state: { iteration: number; activeGoals: string[]; lastTickAt: string }): void {
  ensureStateDir(root);
  writeFileSync(join(root, HEARTBEAT_STATE_FILE), JSON.stringify(state, null, 2), "utf8");
}

function loadActiveGoals(options: GoalStoreOptions): GoalRecord[] {
  const state = loadHeartbeatState(options.root);
  if (!state || state.activeGoals.length === 0) {
    return [];
  }

  return state.activeGoals
    .map((id) => loadGoal(options, id))
    .filter((record): record is GoalRecord => Boolean(record && record.status === "active"));
}

function matchScheduledGoals(options: ScheduleOptions, now: Date): GoalRecord[] {
  const allGoals = loadAllGoals(options);
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

function loadDueGoals(options: GoalStoreOptions, intervalMs: number): GoalRecord[] {
  const allGoals = loadAllGoals(options);
  const now = Date.now();
  return allGoals.filter((record) => {
    const updatedAt = record.updatedAt.getTime();
    return record.status === "scheduled" && now - updatedAt >= intervalMs;
  });
}

function ensureStateDir(root: string): void {
  mkdirSync(root, { recursive: true });
}

function parseDurationToMs(expression: string, fallbackMs: number): number {
  const match = expression.match(/^PT(?:([0-9]+)H)?(?:([0-9]+)M)?(?:([0-9]+)S)?$/);
  if (!match) {
    return fallbackMs;
  }

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return (hours * 60 + minutes) * 60 * 1000 + seconds * 1000;
}
