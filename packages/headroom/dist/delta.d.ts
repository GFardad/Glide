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
export declare function resolveSnapshotDir(root: string): string;
export declare function resolveHistoryPath(root: string): string;
export declare function ensureSnapshotDir(root: string): string;
export declare function snapshotId(): string;
export declare function appendHistoryLine(root: string, line: string): void;
export declare function readHistoryLines(root: string): string[];
export declare function writeSnapshot(snapshot: HeadroomSnapshot, root: string): string;
export declare function loadLatestSnapshot(root: string): HeadroomSnapshot | undefined;
export declare function loadSnapshot(root: string, id: string): HeadroomSnapshot | undefined;
export declare function listSnapshotIds(root: string): string[];
export declare function recordToSnapshot(record: GoalRecordSnapshot): GoalRecordSnapshot;
//# sourceMappingURL=delta.d.ts.map