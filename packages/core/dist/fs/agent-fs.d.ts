import { AgentContext, AgentFileContract } from "../contract.js";
import type { AgentDirectory } from "./schemas.js";
declare const REQUIRED_AGENT_FILES: readonly ["PERSONALITY.md", "GOAL.md", "NOTES.md", "TODO.md", "REJECTED.md", "contract.json"];
export type RequiredAgentFile = (typeof REQUIRED_AGENT_FILES)[number];
export { AgentDirectory } from "./schemas.js";
export declare function agentDir(workspace: string, agentId: string): string;
export declare function agentFilePath(workspace: string, agentId: string, file: RequiredAgentFile): string;
export declare function validateAgentDirectory(workspace: string, agentId: string): void;
export declare function ensureAgentFiles(workspace: string, agent: AgentContext): void;
export declare function loadAgentDirectory(workspace: string, agentId: string): AgentDirectory;
export declare function createAgentFileContract(workspace: string, agent: AgentContext): AgentFileContract;
export declare function listAgentDirectories(workspace: string): string[];
export declare function cleanupAgentDirectory(workspace: string, agentId: string): void;
//# sourceMappingURL=agent-fs.d.ts.map