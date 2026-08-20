import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GoalRecord, GoalStatus } from "@glide/core";
import { atomicAppendFileSync } from "@glide/core";

export interface GoalStoreOptions {
  root: string;
  database?: unknown;
}

export function resetGoalStoreCache(): void {
  // no-op for file-backed store
}

function resolveDatabase(options: GoalStoreOptions): DatabaseLike {
  if (options.database) {
    return options.database as DatabaseLike;
  }

  return createFileDatabase(options.root);
}

interface DatabaseLike {
  prepare(): StatementLike;
  exec(sql?: string): void;
}

interface StatementLike {
  run(): { changes: number };
  get(): Record<string, unknown> | undefined;
  all(): Record<string, unknown>[];
}

function createFileDatabase(root: string) {
  const goalsPath = join(root, "goals.json");

  function load(): Record<string, unknown>[] {
    if (!existsSync(goalsPath)) {
      return [];
    }
    return JSON.parse(readFileSync(goalsPath, "utf8")) as Record<string, unknown>[];
  }

  return {
    prepare() {
      return {
        run() {
          return { changes: 1 };
        },
        get() {
          return undefined;
        },
        all() {
          return load();
        },
      };
    },
    exec() {
      if (!existsSync(goalsPath)) {
        mkdirSync(root, { recursive: true });
        writeFileSync(goalsPath, "[]", "utf8");
      }
    },
  };
}

export function createGoalRecord(
  text: string,
  options?: Partial<Pick<GoalRecord, "id" | "campaignId" | "status" | "source" | "metadata">> & { createdAt?: Date | string; updatedAt?: Date | string }
): GoalRecord {
  const now = new Date();
  return {
    id: options?.id ?? nanoid(),
    campaignId: options?.campaignId,
    goal: text,
    status: options?.status ?? "active",
    source: options?.source,
    createdAt: options?.createdAt instanceof Date ? options.createdAt : (options?.createdAt ? new Date(options.createdAt) : now),
    updatedAt: options?.updatedAt instanceof Date ? options.updatedAt : (options?.updatedAt ? new Date(options.updatedAt) : now),
    metadata: options?.metadata,
  };
}

export async function persistGoal(options: GoalStoreOptions, record: GoalRecord): Promise<GoalRecord> {
  const db = resolveDatabase(options);
  db.exec();

  const goalsPath = join(options.root, "goals.json");
  let goals: Record<string, unknown>[] = [];
  if (existsSync(goalsPath)) {
    goals = JSON.parse(readFileSync(goalsPath, "utf8")) as Record<string, unknown>[];
  }

  const existing = goals.find((g) => g.id === record.id);
  if (existing) {
    existing.status = record.status;
    existing.updated_at = record.updatedAt.toISOString();
    existing.metadata = record.metadata ? JSON.stringify(record.metadata) : null;
  } else {
    goals.push({
      id: record.id,
      campaign_id: record.campaignId,
      goal: record.goal,
      status: record.status,
      source: record.source,
      created_at: record.createdAt.toISOString(),
      updated_at: record.updatedAt.toISOString(),
      metadata: record.metadata ? JSON.stringify(record.metadata) : null,
    });
  }

  mkdirSync(options.root, { recursive: true });
  writeFileSync(goalsPath, JSON.stringify(goals, null, 2), "utf8");

  return record;
}

export async function loadGoal(options: GoalStoreOptions, id: string): Promise<GoalRecord | undefined> {
  const goalsPath = join(options.root, "goals.json");
  if (!existsSync(goalsPath)) {
    return undefined;
  }

  const goals = JSON.parse(readFileSync(goalsPath, "utf8")) as Record<string, unknown>[];
  const row = goals.find((g) => g.id === id);
  if (!row) return undefined;

  return {
    id: row.id as string,
    campaignId: row.campaign_id as string | undefined,
    goal: row.goal as string,
    status: row.status as GoalStatus,
    source: (row.source as string | undefined) ?? undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
    metadata: row.metadata ? (JSON.parse(row.metadata as string) as Record<string, unknown>) : undefined,
  };
}

export async function loadGoalsByCampaign(options: GoalStoreOptions, campaignId: string): Promise<GoalRecord[]> {
  const goalsPath = join(options.root, "goals.json");
  if (!existsSync(goalsPath)) {
    return [];
  }

  const goals = JSON.parse(readFileSync(goalsPath, "utf8")) as Record<string, unknown>[];
  return goals
    .filter((row) => row.campaign_id === campaignId)
    .map((row) => ({
      id: row.id as string,
      campaignId: row.campaign_id as string | undefined,
      goal: row.goal as string,
      status: row.status as GoalStatus,
      source: (row.source as string | undefined) ?? undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      metadata: row.metadata ? (JSON.parse(row.metadata as string) as Record<string, unknown>) : undefined,
    }));
}

export async function updateGoalStatus(
  options: GoalStoreOptions,
  id: string,
  status: GoalStatus
): Promise<GoalRecord | undefined> {
  const goalsPath = join(options.root, "goals.json");
  if (!existsSync(goalsPath)) {
    return undefined;
  }

  const goals = JSON.parse(readFileSync(goalsPath, "utf8")) as Record<string, unknown>[];
  const existing = goals.find((g) => g.id === id);
  if (!existing) return undefined;

  existing.status = status;
  existing.updated_at = new Date().toISOString();

  mkdirSync(options.root, { recursive: true });
  writeFileSync(goalsPath, JSON.stringify(goals, null, 2), "utf8");

  return loadGoal(options, id);
}

export async function loadActiveGoals(options: GoalStoreOptions): Promise<GoalRecord[]> {
  const all = await loadAllGoals(options);
  return all.filter((record) => record.status === "active");
}

export async function loadAllGoals(options: GoalStoreOptions): Promise<GoalRecord[]> {
  const goalsPath = join(options.root, "goals.json");
  if (!existsSync(goalsPath)) {
    return [];
  }

  const goals = JSON.parse(readFileSync(goalsPath, "utf8")) as Record<string, unknown>[];
  return goals.map((row) => ({
    id: row.id as string,
    campaignId: row.campaign_id as string | undefined,
    goal: row.goal as string,
    status: row.status as GoalStatus,
    source: (row.source as string | undefined) ?? undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
    metadata: row.metadata ? (JSON.parse(row.metadata as string) as Record<string, unknown>) : undefined,
  }));
}

export function writeGoalSnapshot(options: GoalStoreOptions, records: GoalRecord[]): void {
  const path = join(options.root, "goal-snapshot.json");
  writeFileSync(path, JSON.stringify(records, null, 2), "utf8");
}

export function readGoalSnapshot(options: GoalStoreOptions): GoalRecord[] {
  const path = join(options.root, "goal-snapshot.json");

  if (!existsSync(path)) {
    return [];
  }

  return JSON.parse(readFileSync(path, "utf8")) as GoalRecord[];
}

export function appendGoalJsonl(options: GoalStoreOptions, record: GoalRecord): void {
  const path = join(options.root, "goals.jsonl");
  const line = JSON.stringify({ ...record, _ts: Date.now() }) + "\n";

  if (!existsSync(path)) {
    mkdirSync(options.root, { recursive: true });
  }

  atomicAppendFileSync(path, line);
}

export function readGoalJsonl(options: GoalStoreOptions): GoalRecord[] {
  const path = join(options.root, "goals.jsonl");

  if (!existsSync(path)) {
    return [];
  }

  const content = readFileSync(path, "utf8");
  const lines = content.split("\n").filter((line) => line.trim().length > 0);

  return lines.map((line) => JSON.parse(line) as GoalRecord);
}

export function runScheduledGoals(): void {
  // Placeholder for scheduled goal execution.
}

function nanoid(size = 21): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < size; i++) {
    id += alphabet[(bytes[i] as number) % alphabet.length];
  }
  return id;
}
