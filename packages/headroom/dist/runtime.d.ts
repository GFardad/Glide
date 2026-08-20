import type { HeadroomDelta, HeadroomSnapshot } from "./delta.js";
export interface HeadroomRuntimeState {
    campaign: {
        id: string;
        root: string;
        goal: string;
        nonGoals: string[];
        assumptions: string[];
        createdAt: string;
        updatedAt: string;
    };
    snapshot: HeadroomSnapshot | undefined;
}
export interface HeadroomRuntimeOptions {
    root: string;
    tracer?: {
        log(event: {
            action: string;
            status: string;
            detail?: string;
        }, correlation?: {
            traceId?: string;
            spanId?: string;
            sessionId?: string;
        }): Promise<void>;
    };
}
export declare class HeadroomRuntime {
    private readonly root;
    private readonly tracer?;
    private initialized;
    private state;
    constructor(options: HeadroomRuntimeOptions | string);
    initialize(objective: string): Promise<HeadroomRuntimeState>;
    init(objective: string): Promise<HeadroomRuntimeState>;
    start(): void;
    stop(): void;
    dispose(): void;
    isInitialized(): boolean;
    getState(): HeadroomRuntimeState | null;
    applyDelta(delta: HeadroomDelta): HeadroomSnapshot;
    rollback(snapshotId: string): HeadroomSnapshot;
    loadLatestSnapshot(): HeadroomSnapshot | undefined;
    private toState;
    private buildSnapshot;
    private emptySnapshot;
}
//# sourceMappingURL=runtime.d.ts.map