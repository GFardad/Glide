import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { GoalRecord, GoalStatus } from "@glide/core";

export interface GoalStoreOptions {
  root: string;
  database?: unknown;
}

interface DatabaseLike {
  prepare(sql: string): StatementLike;
  exec(sql: string): void;
}

interface StatementLike {
  run(params?: unknown[]): { changes: number };
  get(params?: unknown[]): Record<string, unknown> | undefined;
  all(params?: unknown[]): Record<string, unknown>[];
}

const GOAL_FILE = "goals.jsonl";

let database: DatabaseLike | undefined;

function resolveDatabase(options: GoalStoreOptions): DatabaseLike {
  if (options.database) {
    return options.database as DatabaseLike;
  }

  if (!database) {
    const { DatabaseSync: NativeDatabaseSync } = require("node:sqlite") as {
      DatabaseSync: new (filename?: string) => DatabaseLike;
    };
    database = new NativeDatabaseSync(join(options.root, "goals.db"));
    database.exec(
      `CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY,
        campaign_id TEXT,
        goal TEXT NOT NULL,
        status TEXT NOT NULL,
        source TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        metadata TEXT
      )`
    );
    database.exec(
      `CREATE INDEX IF NOT EXISTS idx_goals_campaign_id ON goals(campaign_id)`
    );
    database.exec(
      `CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status)`
    );
  }

  return database;
}

function ensureGoalDir(root: string): void {
  mkdirSync(root, { recursive: true });
}

function rowToRecord(row: Record<string, unknown>): GoalRecord {
  const metadataRaw = row.metadata;
  const record: GoalRecord = {
    id: row.id as string,
    goal: row.goal as string,
    status: row.status as GoalStatus,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
  const campaignId = row.campaign_id;
  if (campaignId !== null && campaignId !== undefined) record.campaignId = campaignId as string;
  const source = row.source;
  if (source !== null && source !== undefined) record.source = source as string;
  if (metadataRaw) record.metadata = JSON.parse(metadataRaw as string) as Record<string, unknown>;
  return record;
}

function recordToRow(record: GoalRecord): Record<string, unknown> {
  return {
    id: record.id,
    campaign_id: record.campaignId ?? null,
    goal: record.goal,
    status: record.status,
    source: record.source ?? null,
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString(),
    metadata: record.metadata ? JSON.stringify(record.metadata) : null,
  };
}

function appendJsonl(root: string, record: GoalRecord): void {
  ensureGoalDir(root);
  appendFileSync(join(root, GOAL_FILE), JSON.stringify(record) + "\n", "utf8");
}

export function createGoalRecord(goal: string, overrides?: Partial<GoalRecord>): GoalRecord {
  const now = new Date();
  const record: GoalRecord = {
    id: overrides?.id ?? `goal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    goal,
    status: overrides?.status ?? "active",
    createdAt: overrides?.createdAt ?? now,
    updatedAt: overrides?.updatedAt ?? now,
  };
  if (overrides?.campaignId !== undefined) record.campaignId = overrides.campaignId;
  if (overrides?.source !== undefined) record.source = overrides.source;
  if (overrides?.metadata !== undefined) record.metadata = overrides.metadata;
  return record;
}

export function persistGoal(options: GoalStoreOptions, record: GoalRecord): GoalRecord {
  const root = options.root;
  ensureGoalDir(root);
  const db = resolveDatabase(options);
  const row = recordToRow(record);

  db.prepare(
    `INSERT INTO goals (id, campaign_id, goal, status, source, created_at, updated_at, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       campaign_id = excluded.campaign_id,
       goal = excluded.goal,
       status = excluded.status,
       source = excluded.source,
       updated_at = excluded.updated_at,
       metadata = excluded.metadata`
  ).run([
    row.id,
    row.campaign_id,
    row.goal,
    row.status,
    row.source,
    row.created_at,
    row.updated_at,
    row.metadata,
  ]);

  appendJsonl(root, record);
  return record;
}

export function loadGoal(options: GoalStoreOptions, id: string): GoalRecord | undefined {
  const db = resolveDatabase(options);
  const row = db.prepare(`SELECT * FROM goals WHERE id = ?`).get([id]) as Record<string, unknown> | undefined;
  return row ? rowToRecord(row) : undefined;
}

export function loadGoalsByCampaign(options: GoalStoreOptions, campaignId: string): GoalRecord[] {
  const db = resolveDatabase(options);
  const rows = db.prepare(`SELECT * FROM goals WHERE campaign_id = ? ORDER BY created_at ASC`).all([campaignId]) as Record<string, unknown>[];
  return rows.map(rowToRecord);
}

export function updateGoalStatus(options: GoalStoreOptions, id: string, status: GoalStatus): GoalRecord | undefined {
  const existing = loadGoal(options, id);
  if (!existing) {
    return undefined;
  }

  const updated: GoalRecord = {
    ...existing,
    status,
    updatedAt: new Date(),
  };

  return persistGoal(options, updated);
}

export function loadActiveGoals(options: GoalStoreOptions): GoalRecord[] {
  const db = resolveDatabase(options);
  const rows = db.prepare(`SELECT * FROM goals WHERE status = ? ORDER BY created_at ASC`).all(["active"]) as Record<string, unknown>[];
  return rows.map(rowToRecord);
}

export function loadAllGoals(options: GoalStoreOptions): GoalRecord[] {
  const db = resolveDatabase(options);
  const rows = db.prepare(`SELECT * FROM goals ORDER BY created_at ASC`).all([]) as Record<string, unknown>[];
  return rows.map(rowToRecord);
}

export function writeGoalSnapshot(options: GoalStoreOptions, records: GoalRecord[]): void {
  const root = options.root;
  ensureGoalDir(root);
  const snapshotPath = join(root, GOAL_FILE);
  writeFileSync(snapshotPath, records.map((record) => JSON.stringify(record)).join("\n") + "\n", "utf8");
}

export function readGoalSnapshot(options: GoalStoreOptions): GoalRecord[] {
  const path = join(options.root, GOAL_FILE);
  if (!existsSync(path)) {
    return [];
  }

  const raw = readFileSync(path, "utf8");
  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as GoalRecord);
}
