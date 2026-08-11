import { describe, it, expect, beforeEach } from "vitest";
import {
  mkdirSync,
  rmSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  ensureAgentContract,
  loadAgentContract,
  appendNote,
  markTodoDone,
  recordRejection,
  listAgents,
  cleanupAgentWorkspace,
} from "../packages/executor/src/runtime.js";
import {
  REQUIRED_AGENT_FILES,
  generateAgentContract,
  validateAgentContract,
} from "../packages/executor/src/contract.js";

describe("executor runtime", () => {
  const tmpRoot = "/tmp/glide-executor-test";

  beforeEach(() => {
    if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true });
    mkdirSync(tmpRoot, { recursive: true });
  });

  it("creates agent contract files when missing", () => {
    const workspace = join(tmpRoot, "ws1");
    mkdirSync(workspace, { recursive: true });
    ensureAgentContract(workspace, {
      sessionId: "s1",
      agentId: "agent-1",
      cwd: workspace,
      teamId: "team-1",
      parentId: "parent-1",
    });

    const agentDir = join(workspace, "agents", "agent-1");
    expect(existsSync(join(agentDir, "GOAL.md"))).toBe(true);
    expect(existsSync(join(agentDir, "PERSONALITY.md"))).toBe(true);
    expect(existsSync(join(agentDir, "NOTES.md"))).toBe(true);
    expect(existsSync(join(agentDir, "TODO.md"))).toBe(true);
    expect(existsSync(join(agentDir, "REJECTED.md"))).toBe(true);
  });

  it("does not overwrite existing contract files", () => {
    const workspace = join(tmpRoot, "ws2");
    mkdirSync(workspace, { recursive: true });
    ensureAgentContract(workspace, {
      sessionId: "s1",
      agentId: "agent-2",
      cwd: workspace,
    });
    const goalPath = join(workspace, "agents", "agent-2", "GOAL.md");
    writeFileSync(goalPath, "original", "utf8");
    ensureAgentContract(workspace, {
      sessionId: "s1",
      agentId: "agent-2",
      cwd: workspace,
    });
    expect(readFileSync(goalPath, "utf8")).toBe("original");
  });

  it("loads agent contract", () => {
    const workspace = join(tmpRoot, "ws3");
    mkdirSync(workspace, { recursive: true });
    ensureAgentContract(workspace, {
      sessionId: "s1",
      agentId: "agent-3",
      cwd: workspace,
    });
    const contract = loadAgentContract(workspace, "agent-3");
    expect(contract.personality).toContain("Agent: agent-3");
    expect(contract.goal).toContain("Agent: agent-3");
    expect(contract.notes).toEqual(["# Notes"]);
    expect(contract.todos).toEqual(["# TODO"]);
    expect(contract.rejected).toEqual(["# Rejected"]);
  });

  it("appends notes", () => {
    const workspace = join(tmpRoot, "ws4");
    mkdirSync(workspace, { recursive: true });
    ensureAgentContract(workspace, {
      sessionId: "s1",
      agentId: "agent-4",
      cwd: workspace,
    });
    appendNote(workspace, "agent-4", "First note");
    appendNote(workspace, "agent-4", "Second note");

    const notesPath = join(workspace, "agents", "agent-4", "NOTES.md");
    const notes = readFileSync(notesPath, "utf8");
    expect(notes).toContain("First note");
    expect(notes).toContain("Second note");
  });

  it("marks todo done", () => {
    const workspace = join(tmpRoot, "ws5");
    mkdirSync(workspace, { recursive: true });
    ensureAgentContract(workspace, {
      sessionId: "s1",
      agentId: "agent-5",
      cwd: workspace,
    });
    writeFileSync(
      join(workspace, "agents", "agent-5", "TODO.md"),
      "- [ ] Task A\n",
      "utf8"
    );
    markTodoDone(workspace, "agent-5", "Task A");

    const todoPath = join(workspace, "agents", "agent-5", "TODO.md");
    const todos = readFileSync(todoPath, "utf8");
    expect(todos).toContain("- [x] Task A");
  });

  it("records rejection with reason", () => {
    const workspace = join(tmpRoot, "ws6");
    mkdirSync(workspace, { recursive: true });
    ensureAgentContract(workspace, {
      sessionId: "s1",
      agentId: "agent-6",
      cwd: workspace,
    });
    recordRejection(workspace, "agent-6", "Bad idea", "violates policy", "qa");

    const rejectedPath = join(workspace, "agents", "agent-6", "REJECTED.md");
    const rejected = readFileSync(rejectedPath, "utf8");
    expect(rejected).toContain("Bad idea");
    expect(rejected).toContain("violates policy");
  });

  it("lists agents", () => {
    const workspace = join(tmpRoot, "ws7");
    mkdirSync(workspace, { recursive: true });
    ensureAgentContract(workspace, {
      sessionId: "s1",
      agentId: "agent-7a",
      cwd: workspace,
    });
    ensureAgentContract(workspace, {
      sessionId: "s1",
      agentId: "agent-7b",
      cwd: workspace,
    });

    const agents = listAgents(workspace);
    expect(agents).toContain("agent-7a");
    expect(agents).toContain("agent-7b");
  });

  it("cleans up agent workspace", () => {
    const workspace = join(tmpRoot, "ws8");
    mkdirSync(workspace, { recursive: true });
    ensureAgentContract(workspace, {
      sessionId: "s1",
      agentId: "agent-8",
      cwd: workspace,
    });
    cleanupAgentWorkspace(workspace, "agent-8");

    const agentDir = join(workspace, "agents", "agent-8");
    expect(existsSync(agentDir)).toBe(false);
  });
});

describe("executor agent file contract", () => {
  const tmpRoot = "/tmp/glide-contract-test";

  beforeEach(() => {
    if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true });
    mkdirSync(tmpRoot, { recursive: true });
  });

  it("declares the five required agent files", () => {
    expect(REQUIRED_AGENT_FILES).toEqual([
      "PERSONALITY.md",
      "GOAL.md",
      "NOTES.md",
      "TODO.md",
      "REJECTED.md",
    ]);
  });

  it("generates all five files with expected sections", () => {
    const workspace = join(tmpRoot, "gen1");
    mkdirSync(workspace, { recursive: true });
    const contract = generateAgentContract(workspace, {
      sessionId: "s1",
      agentId: "agent-gen-1",
      cwd: workspace,
      teamId: "team-1",
    });

    for (const file of REQUIRED_AGENT_FILES) {
      expect(existsSync(join(workspace, "agents", "agent-gen-1", file))).toBe(
        true
      );
    }

    expect(contract.goal).toContain("## Objective");
    expect(contract.goal).toContain("## Acceptance Criteria");
    expect(contract.personality).toContain("## Behavior");
    expect(contract.goal).toContain("Agent: agent-gen-1");
    expect(contract.goal).toContain("Team: team-1");
  });

  it("validates a freshly generated contract as valid", () => {
    const workspace = join(tmpRoot, "gen2");
    mkdirSync(workspace, { recursive: true });
    generateAgentContract(workspace, {
      sessionId: "s1",
      agentId: "agent-gen-2",
      cwd: workspace,
    });

    const result = validateAgentContract(workspace, "agent-gen-2");
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.incomplete).toEqual([]);
  });

  it("reports missing files for an empty agent dir", () => {
    const workspace = join(tmpRoot, "gen3");
    mkdirSync(workspace, { recursive: true });
    mkdirSync(join(workspace, "agents", "agent-gen-3"), { recursive: true });

    const result = validateAgentContract(workspace, "agent-gen-3");
    expect(result.valid).toBe(false);
    expect(result.missing.sort()).toEqual([...REQUIRED_AGENT_FILES].sort());
  });

  it("reports incomplete files when expected sections are absent", () => {
    const workspace = join(tmpRoot, "gen4");
    mkdirSync(workspace, { recursive: true });
    const agentDir = join(workspace, "agents", "agent-gen-4");
    mkdirSync(agentDir, { recursive: true });

    for (const file of REQUIRED_AGENT_FILES) {
      writeFileSync(join(agentDir, file), `# ${file}\n`, "utf8");
    }

    const result = validateAgentContract(workspace, "agent-gen-4");
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual([]);
    expect(result.incomplete).toContain("PERSONALITY.md");
    expect(result.incomplete).toContain("GOAL.md");
  });

  it("does not overwrite existing contract files on regenerate", () => {
    const workspace = join(tmpRoot, "gen5");
    mkdirSync(workspace, { recursive: true });
    generateAgentContract(workspace, {
      sessionId: "s1",
      agentId: "agent-gen-5",
      cwd: workspace,
    });

    const goalPath = join(workspace, "agents", "agent-gen-5", "GOAL.md");
    writeFileSync(goalPath, "custom goal", "utf8");

    generateAgentContract(workspace, {
      sessionId: "s1",
      agentId: "agent-gen-5",
      cwd: workspace,
    });

    expect(readFileSync(goalPath, "utf8")).toBe("custom goal");
  });
});
