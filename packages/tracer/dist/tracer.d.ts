import type { TraceEvent } from "./trace-runtime.js";
export interface AgentTrace {
    agentId: string;
    goal: string;
    notes: string[];
    todos: string[];
    rejected: string[];
    parentId: string;
    children: string[];
    depth: number;
    sessionPath?: string | undefined;
}
export interface TracerRuntimeOptions {
    rootDir?: string;
    fileName?: string;
}
export interface TraceCorrelation {
    traceId?: string;
    spanId?: string;
    sessionId?: string;
}
export declare class TracerRuntime {
    private readonly traceRuntime;
    private readonly traceStore;
    /** Bound on in-memory trace entries to prevent unbounded growth (audit-perf #16). */
    private static readonly MAX_TRACE_ENTRIES;
    constructor(options?: TracerRuntimeOptions);
    log(event: Omit<TraceEvent, "_seq" | "_ts">, correlation?: TraceCorrelation): Promise<void>;
    readAll(): Promise<TraceEvent[]>;
    clear(): Promise<void>;
    traceAgent(options: {
        workspace: string;
        agentId: string;
        depth?: number;
        sessionId?: string;
    }): Promise<AgentTrace>;
    indepthAgent(options: {
        workspace: string;
        agentId: string;
        sessionId?: string;
    }): Promise<string>;
    private recordTrace;
}
export declare function traceAgent(options: {
    workspace: string;
    agentId: string;
    depth?: number;
}): Promise<AgentTrace>;
export declare function indepthAgent(options: {
    workspace: string;
    agentId: string;
    sessionId?: string;
}): Promise<string>;
/**
 * @deprecated Prefer instantiating `new TracerRuntime(options)` directly.
 */
export declare function createTracer(options?: TracerRuntimeOptions): TracerRuntime;
//# sourceMappingURL=tracer.d.ts.map