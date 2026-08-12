import {
  type RequiredAgentFile as CoreRequiredAgentFile,
} from "@glide/core";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { AgentContext } from "./runtime.js";
import { atomicWriteFileSync } from "@glide/core";

export const REQUIRED_AGENT_FILES = [
  "PERSONALITY.md",
  "GOAL.md",
  "NOTES.md",
  "TODO.md",
  "REJECTED.md",
] as const;

export type RequiredAgentFile = CoreRequiredAgentFile;

export interface ContractValidationResult {
  valid: boolean;
  missing: string[];
  incomplete: string[];
}

export function createAgentContext(partial: {
  cwd: string;
  agentId?: string | undefined;
  sessionId?: string | undefined;
  teamId?: string | undefined;
  parentId?: string | undefined;
  metadata?: Record<string, string> | undefined;
}): AgentContext {
  const { agentId, sessionId, teamId, parentId, metadata } = partial;
  const result: AgentContext = {
    agentId: agentId ?? "",
    sessionId: sessionId ?? "",
    cwd: partial.cwd,
  };
  if (teamId !== undefined) result.teamId = teamId;
  if (parentId !== undefined) result.parentId = parentId;
  if (metadata !== undefined) result.metadata = metadata;
  return result;
}

export function generateAgentContract(workspace: string, agent: AgentContext) {
  const agentDir = join(workspace, "agents", agent.agentId);
  mkdirSync(agentDir, { recursive: true });

  const files = REQUIRED_AGENT_FILES;
  for (const file of files) {
    const path = join(agentDir, file);
    if (!existsSync(path)) {
      atomicWriteFileSync(path, defaultFileContent(file, agent));
    }
  }

  const contract = {
    agentId: agent.agentId,
    teamId: agent.teamId,
    sessionId: agent.sessionId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  atomicWriteFileSync(join(agentDir, "contract.json"), JSON.stringify(contract, null, 2));

  return loadAgentDirectory(workspace, agent.agentId);
}

export function validateAgentContract(
  workspace: string,
  agentId: string
): ContractValidationResult {
  const missing: string[] = [];
  const incomplete: string[] = [];

  for (const file of REQUIRED_AGENT_FILES) {
    const path = join(workspace, "agents", agentId, file);
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

function hasExpectedSection(content: string, section: string): boolean {
  const normalized = content.toLowerCase();
  const marker = `## ${section.toLowerCase()}`;
  return normalized.includes(marker);
}

function defaultFileContent(file: string, agent: AgentContext): string {
  switch (file) {
    case "PERSONALITY.md":
      return `# Personality\n\nAgent: ${agent.agentId}\nSession: ${agent.sessionId}\nTeam: ${agent.teamId ?? "none"}\nParent: ${agent.parentId ?? "none"}\n\n## Behavior\n- Produce concise, actionable outputs.\n- Write failures and blockers to NOTES.md.\n- Append completed todos with timestamps.\n`;
    case "GOAL.md":
      return `# Goal\n\nAgent: ${agent.agentId}\nSession: ${agent.sessionId}\nTeam: ${agent.teamId ?? "none"}\nParent: ${agent.parentId ?? "none"}\n\n## Objective\nTBD\n\n## Acceptance Criteria\n- Deliver notes and todos through runtime interfaces.\n- Do not access internal state of other agents.\n`;
    case "NOTES.md":
      return "# Notes\n\n";
    case "TODO.md":
      return "# TODO\n\n";
    case "REJECTED.md":
      return "# Rejected\n\n";
    default:
      return "";
  }
}

function loadAgentDirectory(workspace: string, agentId: string) {
  const agentDir = join(workspace, "agents", agentId);
  return {
    personality: readFileSync(join(agentDir, "PERSONALITY.md"), "utf8"),
    goal: readFileSync(join(agentDir, "GOAL.md"), "utf8"),
    notes: readFileSync(join(agentDir, "NOTES.md"), "utf8"),
    todos: readFileSync(join(agentDir, "TODO.md"), "utf8"),
    rejected: readFileSync(join(agentDir, "REJECTED.md"), "utf8"),
  };
}