import type { GoalRecord, GoalStatus } from "@glide/core";
export interface GoalStoreOptions {
    root: string;
    database?: unknown;
}
export declare function resetGoalStoreCache(): void;
export declare function createGoalRecord(text: string, options?: Partial<Pick<GoalRecord, "id" | "campaignId" | "status" | "source" | "metadata">> & {
    createdAt?: Date | string;
    updatedAt?: Date | string;
}): GoalRecord;
export declare function persistGoal(options: GoalStoreOptions, record: GoalRecord): Promise<GoalRecord>;
export declare function loadGoal(options: GoalStoreOptions, id: string): Promise<GoalRecord | undefined>;
export declare function loadGoalsByCampaign(options: GoalStoreOptions, campaignId: string): Promise<GoalRecord[]>;
export declare function updateGoalStatus(options: GoalStoreOptions, id: string, status: GoalStatus): Promise<GoalRecord | undefined>;
export declare function loadActiveGoals(options: GoalStoreOptions): Promise<GoalRecord[]>;
export declare function loadAllGoals(options: GoalStoreOptions): Promise<GoalRecord[]>;
export declare function writeGoalSnapshot(options: GoalStoreOptions, records: GoalRecord[]): void;
export declare function readGoalSnapshot(options: GoalStoreOptions): GoalRecord[];
export declare function appendGoalJsonl(options: GoalStoreOptions, record: GoalRecord): void;
export declare function readGoalJsonl(options: GoalStoreOptions): GoalRecord[];
export declare function runScheduledGoals(): void;
//# sourceMappingURL=goal-store.d.ts.map