import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";

/**
 * Evidence-backed update describing a reversible change to campaign goals.
 */
export interface HeadroomDelta {
  /** ISO timestamp when the delta was created. */
  timestamp: string;
  /** Human-readable rationale for the change. */
  evidence: string;
  /** Operations that compose this delta. */
  operations: HeadroomDeltaOperation[];
}

/**
 * Atomic operation within a HeadroomDelta.
 */
export interface HeadroomDeltaOperation {
  kind: "add" | "update" | "delete";
  /** Identifier of the goal record being modified. */
  goalId: string;
  /** For `add`/`update`: the new goal text. */
  goal?: string;
  /** For `update`/`delete`: the previous goal text for rollback verification. */
  previousGoal?: string;
  /** For `add`/`update`: optional campaign linkage. */
  campaignId?: string;
  /** Arbitrary metadata carried with the operation. */
  metadata?: Record<string, unknown>;
}

/**
 * Snapshot of the full headroom state at a point in time.
 */
export interface HeadroomSnapshot {
  /** Unique snapshot identifier. */
  id: string;
  /** ISO timestamp when the snapshot was taken. */
  timestamp: string;
  /** Full serialized state of all tracked goals. */
  state: GoalRecordSnapshot[];
  /** Deltas applied since the previous snapshot, oldest first. */
  deltaHistory: HeadroomDelta[];
}

/**
 * Serializable goal record suitable for snapshot storage.
 */
export interface GoalRecordSnapshot {
  id: string;
  campaignId?: string | undefined;
  goal: string;
  status: string;
  source?: string | undefined;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown> | undefined;
}

const DEFAULT_SNAPSHOT_DIR = ".glide-headroom/snapshots";
const HISTORY_FILE = "history.jsonl";

export function resolveSnapshotDir(root: string): string {
  return join(root, DEFAULT_SNAPSHOT_DIR);
}

export function resolveHistoryPath(root: string): string {
  return join(resolveSnapshotDir(root), HISTORY_FILE);
}

export function ensureSnapshotDir(root: string): string {
  const dir = resolveSnapshotDir(root);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function snapshotId(): string {
  return `snapshot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function appendHistoryLine(root: string, line: string): void {
  const path = resolveHistoryPath(root);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, line + "\n", { flag: "a" });
}

export function readHistoryLines(root: string): string[] {
  const path = resolveHistoryPath(root);
  if (!existsSync(path)) {
    return [];
  }
  const raw = readFileSync(path, "utf8");
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function writeSnapshot(snapshot: HeadroomSnapshot, root: string): string {
  const path = resolveHistoryPath(root);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(snapshot) + "\n", { flag: "a" });
  return path;
}

export function loadLatestSnapshot(root: string): HeadroomSnapshot | undefined {
  const lines = readHistoryLines(root);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      const parsed = JSON.parse(lines[i]!) as HeadroomSnapshot;
      if (parsed && parsed.id && parsed.timestamp && Array.isArray(parsed.state)) {
        return parsed;
      }
    } catch {
      // skip malformed lines
    }
  }
  return undefined;
}

export function loadSnapshot(root: string, id: string): HeadroomSnapshot | undefined {
  const lines = readHistoryLines(root);
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as HeadroomSnapshot;
      if (parsed.id === id) {
        return parsed;
      }
    } catch {
      // skip malformed lines
    }
  }
  return undefined;
}

export function listSnapshotIds(root: string): string[] {
  const lines = readHistoryLines(root);
  const ids: string[] = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as HeadroomSnapshot;
      if (parsed && parsed.id && !ids.includes(parsed.id)) {
        ids.push(parsed.id);
      }
    } catch {
      // skip malformed lines
    }
  }
  return ids;
}

export function recordToSnapshot(
  record: GoalRecordSnapshot
): GoalRecordSnapshot {
  return {
    id: record.id,
    campaignId: record.campaignId ?? undefined,
    goal: record.goal,
    status: record.status,
    source: record.source,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    metadata: record.metadata,
  };
}
