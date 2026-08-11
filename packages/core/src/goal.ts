export type GoalStatus = "active" | "scheduled" | "completed" | "abandoned";

export interface GoalRecord {
  /** Stable identifier for the goal. */
  id: string;
  /** Optional parent campaign identifier. */
  campaignId?: string | undefined;
  /** The goal text. */
  goal: string;
  /** Current lifecycle status. */
  status: GoalStatus;
  /** Tool or actor that created the goal. */
  source?: string | undefined;
  /** Timestamp when the goal was created. */
  createdAt: Date;
  /** Timestamp of the most recent goal update. */
  updatedAt: Date;
  /** Freeform metadata for adapters and schedules. */
  metadata?: Record<string, unknown> | undefined;
}
