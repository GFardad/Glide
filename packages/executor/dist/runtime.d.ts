export interface AgentContext {
    sessionId: string;
    agentId: string;
    cwd: string;
    teamId?: string;
    parentId?: string;
    metadata?: Record<string, unknown>;
}
export interface ExecutionOptions {
    timeoutMs?: number;
    retryBudget?: number;
}
export interface ExecutionResult {
    ok: boolean;
    returncode: number;
    stdout: string;
    stderr: string;
    attempt: number;
    retriesLeft: number;
}
export interface AgentFileContract {
    personality: string;
    goal: string;
    notes: string[];
    todos: string[];
    rejected: string[];
}
export declare function ensureAgentContract(workspace: string, agent: AgentContext): void;
export declare function loadAgentContract(workspace: string, agentId: string): AgentFileContract;
export declare function appendNote(workspace: string, agentId: string, message: string): void;
export declare function markTodoDone(workspace: string, agentId: string, todo: string): void;
export declare function recordRejection(workspace: string, agentId: string, item: string, reason: string, rejectedBy?: string): void;
export declare function listAgents(workspace: string): string[];
export declare function cleanupAgentWorkspace(workspace: string, agentId: string): void;
//# sourceMappingURL=runtime.d.ts.map