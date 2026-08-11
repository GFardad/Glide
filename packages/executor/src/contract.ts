import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentFileContract, AgentContext } from "./runtime.js";
import { ensureAgentContract, loadAgentContract } from "./runtime.js";

export const REQUIRED_AGENT_FILES = [
  "PERSONALITY.md",
  "GOAL.md",
  "NOTES.md",
  "TODO.md",
  "REJECTED.md",
] as const;

export type RequiredAgentFile = (typeof REQUIRED_AGENT_FILES)[number];

export interface ContractValidationResult {
  valid: boolean;
  missing: string[];
  incomplete: string[];
}

function hasExpectedSection(content: string, section: string): boolean {
  const normalized = content.toLowerCase();
  const marker = `## ${section.toLowerCase()}`;
  return normalized.includes(marker);
}

export function generateAgentContract(
  workspace: string,
  agent: AgentContext
): AgentFileContract {
  ensureAgentContract(workspace, agent);
  return loadAgentContract(workspace, agent.agentId);
}

export function validateAgentContract(
  workspace: string,
  agentId: string
): ContractValidationResult {
  const agentDir = join(workspace, "agents", agentId);
  const missing: string[] = [];
  const incomplete: string[] = [];

  for (const file of REQUIRED_AGENT_FILES) {
    const path = join(agentDir, file);
    if (!existsSync(path)) {
      missing.push(file);
      continue;
    }

    const content = readFileSync(path, "utf8");
    if (file === "PERSONALITY.md" && !hasExpectedSection(content, "Behavior")) {
      incomplete.push(file);
    }
    if (file === "GOAL.md") {
      const hasObjective = hasExpectedSection(content, "Objective");
      const hasAcceptance = hasExpectedSection(content, "Acceptance Criteria");
      if (!hasObjective || !hasAcceptance) {
        incomplete.push(file);
      }
    }
  }

  return {
    valid: missing.length === 0 && incomplete.length === 0,
    missing,
    incomplete,
  };
}
