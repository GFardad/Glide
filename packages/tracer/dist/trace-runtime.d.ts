import type { JsonlRecord } from "./jsonl-writer.js";
export interface TraceEvent extends JsonlRecord {
    agentId: string;
    action: string;
    status: string;
    detail?: string;
    traceId?: string;
    spanId?: string;
    sessionId?: string;
}
export interface TraceRuntimeOptions {
    rootDir?: string;
    fileName?: string;
    maxBytes?: number;
    maxFiles?: number;
}
export declare class TraceRuntime {
    private readonly writer;
    constructor(options?: TraceRuntimeOptions);
    log(event: Omit<TraceEvent, "_seq" | "_ts">, correlation?: {
        traceId?: string;
        spanId?: string;
        sessionId?: string;
    }): Promise<void>;
    readAll(): Promise<TraceEvent[]>;
    clear(): Promise<void>;
}
//# sourceMappingURL=trace-runtime.d.ts.map