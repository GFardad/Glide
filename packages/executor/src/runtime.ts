import {
  mkdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { join, resolve, sep } from "node:path";

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

function validateWorkspace(workspace: string): string {
  const resolved = resolve(workspace);
  if (!existsSync(resolved)) {
    throw new Error(`Workspace does not exist: ${resolved}`);
  }
  return resolved;
}

function validateAgentDir(workspace: string, agentId: string): string {
  const resolvedWorkspace = validateWorkspace(workspace);
  const agentDir = join(resolvedWorkspace, "agents", agentId);
  const resolvedAgentDir = resolve(agentDir);

  if (!resolvedAgentDir.startsWith(resolvedWorkspace + sep) && resolvedAgentDir !== resolvedWorkspace) {
    throw new Error(`Agent directory escapes workspace: ${agentId}`);
  }

  return resolvedAgentDir;
}

export function ensureAgentContract(
  workspace: string,
  agent: AgentContext
): void {
  const agentDir = validateAgentDir(workspace, agent.agentId);
  mkdirSync(agentDir, { recursive: true });

  const goalPath = join(agentDir, "GOAL.md");
  const personalityPath = join(agentDir, "PERSONALITY.md");
  const notesPath = join(agentDir, "NOTES.md");
  const todosPath = join(agentDir, "TODO.md");
  const rejectedPath = join(agentDir, "REJECTED.md");

  if (!existsSync(goalPath))
    writeFileSync(
      goalPath,
      `# Goal\n\nAgent: ${agent.agentId}\nSession: ${agent.sessionId}\nTeam: ${agent.teamId ?? "none"}\nParent: ${agent.parentId ?? "none"}\n\n## Objective\nTBD\n\n## Acceptance Criteria\n- Deliver notes and todos through runtime interfaces.\n- Do not access internal state of other agents.\n`
    );
  if (!existsSync(personalityPath))
    writeFileSync(
      personalityPath,
      `# Personality\n\nAgent: ${agent.agentId}\nRole: runtime agent\n\n## Behavior\n- Produce concise, actionable outputs.\n- Write failures and blockers to NOTES.md.\n- Append completed todos with timestamps.\n`
    );
  if (!existsSync(notesPath)) writeFileSync(notesPath, `# Notes\n\n`);
  if (!existsSync(todosPath)) writeFileSync(todosPath, `# TODO\n\n`);
  if (!existsSync(rejectedPath)) writeFileSync(rejectedPath, `# Rejected\n\n`);
}

export function loadAgentContract(
  workspace: string,
  agentId: string
): AgentFileContract {
  const agentDir = validateAgentDir(workspace, agentId);
  const read = (name: string, fallback: string[] = []) => {
    const path = join(agentDir, name);
    if (!existsSync(path)) return fallback;
    return readFileSync(path, "utf8")
      .split("\n")
      .filter((line) => line.trim().length > 0);
  };

  return {
    personality: readFileSync(join(agentDir, "PERSONALITY.md"), "utf8"),
    goal: readFileSync(join(agentDir, "GOAL.md"), "utf8"),
    notes: read("NOTES.md"),
    todos: read("TODO.md"),
    rejected: read("REJECTED.md"),
  };
}

export function appendNote(
  workspace: string,
  agentId: string,
  message: string
): void {
  const agentDir = validateAgentDir(workspace, agentId);
  const path = join(agentDir, "NOTES.md");
  const timestamp = new Date().toISOString();
  writeFileSync(
    path,
    `${readFileSync(path, "utf8")}\n- [${timestamp}] ${message}\n`
  );
}

export function markTodoDone(
  workspace: string,
  agentId: string,
  todo: string
): void {
  const agentDir = validateAgentDir(workspace, agentId);
  const path = join(agentDir, "TODO.md");
  const current = readFileSync(path, "utf8");
  const normalized = `- [ ] ${todo}`;
  const done = `- [x] ${todo}`;
  if (current.includes(normalized)) {
    const updated = current.replace(normalized, done);
    writeFileSync(path, updated);
    return;
  }
  const suffix = current.trim().length === 0 ? "" : "\n";
  writeFileSync(path, `${current}${suffix}${done}\n`);
}

export function recordRejection(
  workspace: string,
  agentId: string,
  item: string,
  reason: string,
  rejectedBy = "runtime"
): void {
  const agentDir = validateAgentDir(workspace, agentId);
  const path = join(agentDir, "REJECTED.md");
  const timestamp = new Date().toISOString();
  writeFileSync(
    path,
    `${readFileSync(path, "utf8")}\n- [${timestamp}] ${item} | Reason: ${reason} | RejectedBy: ${rejectedBy}\n`
  );
}

export function listAgents(workspace: string): string[] {
  const resolvedWorkspace = validateWorkspace(workspace);
  const agentsDir = join(resolvedWorkspace, "agents");
  if (!existsSync(agentsDir)) return [];
  return readdirSync(agentsDir).filter((entry) => {
    const full = join(agentsDir, entry);
    return existsSync(full) && existsSync(join(full, "GOAL.md"));
  });
}

export function cleanupAgentWorkspace(
  workspace: string,
  agentId: string
): void {
  const agentDir = validateAgentDir(workspace, agentId);
  if (existsSync(agentDir)) rmSync(agentDir, { recursive: true, force: true });
}
