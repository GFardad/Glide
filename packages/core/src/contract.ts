import { z } from "zod";
import { generateAgentId, generateSessionId, isAgentId } from "./ids.js";
import { atomicWriteFileSync } from "./io/atomic-write.js";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

/* ------------------------------------------------------------------ */
/*  Agent contract schemas                                              */
/* ------------------------------------------------------------------ */

export interface AgentContext {
  agentId: string;
  sessionId: string;
  cwd: string;
  teamId?: string;
  parentId?: string;
  metadata?: Record<string, unknown>;
}

export const AgentContractSchema = z.object({
  agentId: z.string().min(1),
  teamId: z.string().optional(),
  sessionId: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type AgentFileContract = z.infer<typeof AgentContractSchema>;

/* ------------------------------------------------------------------ */
/*  Agent context / lifecycle                                          */
/* ------------------------------------------------------------------ */

export function createAgentContext(partial: {
  agentId?: string;
  sessionId?: string;
  cwd: string;
  teamId?: string;
  parentId?: string;
  metadata?: Record<string, unknown>;
}): AgentContext {
  const {
    agentId: partialAgentId,
    sessionId: partialSessionId,
    cwd,
    teamId,
    parentId,
    metadata,
  } = partial;

  if (partialAgentId !== undefined && !isAgentId(partialAgentId as string)) {
    throw new Error(`Invalid agent ID: ${partialAgentId}`);
  }

  const result: AgentContext = {
    agentId: partialAgentId ?? generateAgentId(),
    sessionId: partialSessionId ?? generateSessionId(),
    cwd,
  };
  if (teamId !== undefined) result.teamId = teamId;
  if (parentId !== undefined) result.parentId = parentId;
  if (metadata !== undefined) result.metadata = metadata;
  return result;
}

/* ------------------------------------------------------------------ */
/*  Agent file contract enforcement                                    */
/* ------------------------------------------------------------------ */

export function ensureAgentContract(workspace: string, agent: AgentContext): void {
  const dir = join(workspace, "teams", agent.teamId ?? "_", "agents", agent.agentId);
  mkdirSync(dir, { recursive: true });

  const contract: AgentFileContract = {
    agentId: agent.agentId,
    teamId: agent.teamId,
    sessionId: agent.sessionId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  atomicWriteFileSync(join(dir, "contract.json"), JSON.stringify(contract, null, 2));
}
