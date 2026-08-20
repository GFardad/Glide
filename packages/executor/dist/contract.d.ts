import { type RequiredAgentFile as CoreRequiredAgentFile } from "@glide/core";
import type { AgentContext } from "./runtime.js";
export declare const REQUIRED_AGENT_FILES: readonly ["PERSONALITY.md", "GOAL.md", "NOTES.md", "TODO.md", "REJECTED.md"];
export type RequiredAgentFile = CoreRequiredAgentFile;
export interface ContractValidationResult {
    valid: boolean;
    missing: string[];
    incomplete: string[];
}
export declare function createAgentContext(partial: {
    cwd: string;
    agentId?: string | undefined;
    sessionId?: string | undefined;
    teamId?: string | undefined;
    parentId?: string | undefined;
    metadata?: Record<string, string> | undefined;
}): AgentContext;
export declare function generateAgentContract(workspace: string, agent: AgentContext): {
    personality: string;
    goal: string;
    notes: string;
    todos: string;
    rejected: string;
};
export declare function validateAgentContract(workspace: string, agentId: string): ContractValidationResult;
//# sourceMappingURL=contract.d.ts.map