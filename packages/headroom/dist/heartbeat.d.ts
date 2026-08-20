import { GoalRecord } from "@glide/core";
import type { GoalStoreOptions } from "./goal-store.js";
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
export declare class HeartbeatService {
    private readonly options;
    private timer;
    private iteration;
    private stopped;
    constructor(options: HeartbeatServiceOptions);
    start(): void;
    stop(): void;
    isRunning(): boolean;
    tick(): Promise<void>;
    runScheduledGoals(options: ScheduleOptions): Promise<GoalRecord[]>;
    loadHeartbeatState(): {
        iteration: number;
        activeGoals: string[];
        lastTickAt: string;
    } | undefined;
    private loadActiveGoals;
    private matchScheduledGoals;
    private loadDueGoals;
    private persistHeartbeatState;
}
//# sourceMappingURL=heartbeat.d.ts.map