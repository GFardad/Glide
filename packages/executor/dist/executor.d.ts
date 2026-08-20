import type { AgentHandle } from "./agent-handle.js";
import type { SessionEventEmitter, SessionStore } from "./session.js";
import { GraphifyClient } from "@glide/tracer";
export interface SpawnAgentOptions {
    command: string;
    args?: string[];
    parentId?: string;
    teamId?: string;
    cwd?: string;
    env?: Record<string, string | undefined>;
    ipcPath?: string;
    killTimeoutMs?: number;
    sessionId?: string;
    traceId?: string;
    spanId?: string;
    sessionEmitter?: SessionEventEmitter | null;
    graphifyClient?: GraphifyClient | null;
    timeoutMs?: number;
}
export interface AgentResult {
    handle: AgentHandle;
    exitCode: number | null;
    error?: Error | undefined;
}
export interface AgentExecutionContext {
    agent: AgentHandle;
    command: string;
    args: string[];
    cwd: string;
    env: Record<string, string | undefined>;
}
export declare function groundWithGraphify(client: GraphifyClient | null | undefined, context: AgentExecutionContext): Promise<void>;
export interface ExecutorRuntimeOptions {
    sessionEmitter?: SessionEventEmitter | null;
}
export declare class ExecutorRuntime {
    private readonly agentRegistry;
    private readonly sessionEmitter;
    constructor(options?: ExecutorRuntimeOptions);
    spawnAgent(options: SpawnAgentOptions): AgentHandle;
    cancelAgent(handle: AgentHandle): void;
    awaitAgent(handle: AgentHandle, timeoutMs?: number): Promise<AgentResult>;
}
export declare function createIpcPath(baseDir: string, handleId: string): string;
export declare function removeIpcPath(ipcPath: string): void;
export declare function resumeAgent(handleId: string, options: {
    sessionStore: SessionStore;
    sessionEmitter: SessionEventEmitter;
    graphifyClient?: GraphifyClient | null;
}): Promise<AgentHandle | null>;
export declare function propagateParentSummary(handle: AgentHandle, options: {
    sessionEmitter: SessionEventEmitter;
    parentId?: string | undefined;
}): Promise<void>;
export declare function spawnAgent(options: SpawnAgentOptions): AgentHandle;
export declare function cancelAgent(handle: AgentHandle): void;
export declare function awaitAgent(handle: AgentHandle, timeoutMs?: number): Promise<AgentResult>;
//# sourceMappingURL=executor.d.ts.map