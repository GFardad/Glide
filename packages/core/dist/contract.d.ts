import { z } from "zod";
export interface AgentContext {
    agentId: string;
    sessionId: string;
    cwd: string;
    teamId?: string;
    parentId?: string;
    metadata?: Record<string, unknown>;
}
export declare const AgentContractSchema: z.ZodObject<{
    agentId: z.ZodString;
    teamId: z.ZodOptional<z.ZodString>;
    sessionId: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    agentId: string;
    sessionId: string;
    createdAt: string;
    updatedAt: string;
    teamId?: string | undefined;
}, {
    agentId: string;
    sessionId: string;
    createdAt: string;
    updatedAt: string;
    teamId?: string | undefined;
}>;
export type AgentFileContract = z.infer<typeof AgentContractSchema>;
export declare function createAgentContext(partial: {
    agentId?: string;
    sessionId?: string;
    cwd: string;
    teamId?: string;
    parentId?: string;
    metadata?: Record<string, unknown>;
}): AgentContext;
export declare function ensureAgentContract(workspace: string, agent: AgentContext): void;
//# sourceMappingURL=contract.d.ts.map