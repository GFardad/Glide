import { describe, it, expect, beforeEach } from "vitest";
import {
  existsSync,
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { glideStatusTool } from "../packages/mcp-server/src/tools/glide-status.js";
import {
  glideGoalSetTool,
  glideGoalGetTool,
} from "../packages/mcp-server/src/tools/glide-goal.js";
import { glidePermissionsTool } from "../packages/mcp-server/src/tools/glide-permissions.js";
import { glideExecutorTool } from "../packages/mcp-server/src/tools/glide-executor.js";
import { glideTracerTool } from "../packages/mcp-server/src/tools/glide-tracer.js";
import { glideTraceTool } from "../packages/mcp-server/src/tools/glide-trace.js";
import { glideIndepthTool } from "../packages/mcp-server/src/tools/glide-indepth.js";
// Barrel import executes the tools/index.ts re-export chain.
import * as toolsIndex from "../packages/mcp-server/src/tools/index.js";

/**
 * Coverage gap tests for mcp-server tool handlers imported from src.
 * Complements the stdio-based test/mcp-server.test.ts (which exercises dist)
 * and test/plan|build|review|ship tests (which already import src).
 */

function textOf(result: {
  content: Array<{ type: string; text?: string }>;
}): string {
  const item = result.content[0];
  return item && typeof item.text === "string" ? item.text : "";
}

function writeAgent(workspace: string, agentId: string, parent = "none") {
  const dir = join(workspace, "agents", agentId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "GOAL.md"), `# Goal\n\nGoal of ${agentId}\n`);
  writeFileSync(
    join(dir, "PERSONALITY.md"),
    `# Personality\n\nParent: ${parent}\n`
  );
  writeFileSync(join(dir, "NOTES.md"), "- note\n");
  writeFileSync(join(dir, "TODO.md"), "- todo\n");
}

describe("tools barrel", () => {
  it("exports all 15 tools", () => {
    const names = Object.keys(toolsIndex).sort();
    expect(names).toContain("glideStatusTool");
    expect(names).toContain("glideGoalSetTool");
    expect(names).toContain("glideGoalGetTool");
    expect(names).toContain("glideHeadroomTool");
    expect(names).toContain("glideExecutorTool");
    expect(names).toContain("glideTracerTool");
    expect(names).toContain("glidePermissionsTool");
    expect(names).toContain("glideIndepthTool");
    expect(names).toContain("glideTraceTool");
    expect(names).toContain("glidePlanTool");
    expect(names).toContain("glideBuildTool");
    expect(names).toContain("glideTestTool");
    expect(names).toContain("glideReviewTool");
    expect(names).toContain("glideShipTool");
    expect(names).toContain("glideWebSearchTool");
  });
});

describe("glide_status", () => {
  it("returns ok status", async () => {
    const result = await glideStatusTool.handler({});
    expect(JSON.parse(textOf(result))).toMatchObject({
      status: "ok",
      version: "0.1.0",
      phase: "1-2",
    });
  });
});

describe("glide_goal_set / glide_goal_get", () => {
  const tmpRoot = "/tmp/glide-goal-src-test";

  beforeEach(() => {
    if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true });
    mkdirSync(tmpRoot, { recursive: true });
  });

  it("creates a campaign with the goal", async () => {
    const campaignDir = join(tmpRoot, "c1");
    const result = await glideGoalSetTool.handler({
      campaign_dir: campaignDir,
      goal: "Build the harness",
    });
    const parsed = JSON.parse(textOf(result));
    expect(parsed.ok).toBe(true);
    expect(parsed.campaign_id).toMatch(/^camp_/);
    expect(parsed.goal).toBe("Build the harness");
    expect(existsSync(join(campaignDir, "campaign.json"))).toBe(true);
    expect(readFileSync(join(campaignDir, "GOAL.md"), "utf8")).toContain(
      "Build the harness"
    );
  });

  it("rejects missing goal args", async () => {
    await expect(
      glideGoalSetTool.handler({ campaign_dir: "/tmp/x" })
    ).rejects.toThrow("campaign_dir and goal are required");
  });

  it("reads back the goal of an existing campaign", async () => {
    const campaignDir = join(tmpRoot, "c2");
    await glideGoalSetTool.handler({
      campaign_dir: campaignDir,
      goal: "Read back",
    });
    const result = await glideGoalGetTool.handler({
      campaign_dir: campaignDir,
    });
    const parsed = JSON.parse(textOf(result));
    expect(parsed.ok).toBe(true);
    expect(parsed.goal).toBe("Read back");
    expect(parsed.campaign_id).toMatch(/^camp_/);
  });

  it("rejects missing campaign_dir for get", async () => {
    await expect(glideGoalGetTool.handler({})).rejects.toThrow(
      "campaign_dir is required"
    );
  });
});

describe("glide_permissions", () => {
  it("authorizes a subject with the required scope", async () => {
    const result = await glidePermissionsTool.handler({
      action: "read",
      resource: "docs",
      subject_id: "agent-1",
      subject_role: "engineer",
    });
    expect(JSON.parse(textOf(result))).toMatchObject({
      subject_id: "agent-1",
      ok: true,
    });
  });

  it("rejects when the secrets scope is missing", async () => {
    const result = await glidePermissionsTool.handler({
      action: "read",
      resource: "secrets",
      subject_id: "agent-1",
      subject_role: "engineer",
    });
    expect(JSON.parse(textOf(result))).toMatchObject({
      ok: false,
      reason: "secrets_scope_required",
    });
  });

  it("returns missing_fields for empty input", async () => {
    const result = await glidePermissionsTool.handler({});
    expect(JSON.parse(textOf(result))).toEqual({
      ok: false,
      reason: "missing_fields",
    });
  });
});

describe("glide_executor", () => {
  const tmpRoot = "/tmp/glide-executor-src-test";

  beforeEach(() => {
    if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true });
    mkdirSync(tmpRoot, { recursive: true });
  });

  it("rejects missing required args", async () => {
    await expect(
      glideExecutorTool.handler({ workspace: tmpRoot })
    ).rejects.toThrow("workspace, agent_id, and action are required");
  });

  it("rejects unknown actions", async () => {
    await expect(
      glideExecutorTool.handler({
        workspace: tmpRoot,
        agent_id: "a",
        action: "nope",
      })
    ).rejects.toThrow("Unknown executor action: nope");
  });

  it("ensures an agent contract", async () => {
    const result = await glideExecutorTool.handler({
      workspace: tmpRoot,
      agent_id: "a1",
      action: "ensure_contract",
      payload: { session_id: "s1", team_id: "t1", parent_id: "p1" },
    });
    expect(JSON.parse(textOf(result))).toMatchObject({
      ok: true,
      action: "ensure_contract",
      agent_id: "a1",
    });
  });

  it("appends a note", async () => {
    await glideExecutorTool.handler({
      workspace: tmpRoot,
      agent_id: "a1",
      action: "ensure_contract",
    });
    const result = await glideExecutorTool.handler({
      workspace: tmpRoot,
      agent_id: "a1",
      action: "append_note",
      payload: { message: "hello" },
    });
    expect(JSON.parse(textOf(result))).toMatchObject({
      ok: true,
      action: "append_note",
    });
  });

  it("marks a todo done", async () => {
    await glideExecutorTool.handler({
      workspace: tmpRoot,
      agent_id: "a1",
      action: "ensure_contract",
    });
    const result = await glideExecutorTool.handler({
      workspace: tmpRoot,
      agent_id: "a1",
      action: "mark_todo_done",
      payload: { todo: "task-1" },
    });
    expect(JSON.parse(textOf(result))).toMatchObject({
      ok: true,
      action: "mark_todo_done",
      todo: "task-1",
    });
  });

  it("records a rejection", async () => {
    await glideExecutorTool.handler({
      workspace: tmpRoot,
      agent_id: "a1",
      action: "ensure_contract",
    });
    const result = await glideExecutorTool.handler({
      workspace: tmpRoot,
      agent_id: "a1",
      action: "record_rejection",
      payload: {
        item: "proposal-x",
        reason: "out of scope",
        rejected_by: "cto",
      },
    });
    expect(JSON.parse(textOf(result))).toMatchObject({
      ok: true,
      action: "record_rejection",
      item: "proposal-x",
    });
  });

  it("lists agents", async () => {
    await glideExecutorTool.handler({
      workspace: tmpRoot,
      agent_id: "a1",
      action: "ensure_contract",
    });
    const result = await glideExecutorTool.handler({
      workspace: tmpRoot,
      agent_id: "a1",
      action: "list_agents",
    });
    expect(JSON.parse(textOf(result))).toMatchObject({
      ok: true,
      action: "list_agents",
    });
  });
});

describe("glide_tracer", () => {
  const tmpRoot = "/tmp/glide-tracer-tool-test";

  beforeEach(() => {
    if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true });
    mkdirSync(tmpRoot, { recursive: true });
  });

  it("traces an agent", async () => {
    writeAgent(tmpRoot, "root");
    const result = await glideTracerTool.handler({
      action: "trace",
      workspace: tmpRoot,
      agent_id: "root",
    });
    const parsed = JSON.parse(textOf(result));
    expect(parsed.ok).toBe(true);
    expect(parsed.agent_id).toBe("root");
    expect(parsed.goal).toContain("Goal of root");
    expect(parsed.notes).toEqual(["- note"]);
  });

  it("returns ok:false when the agent is missing", async () => {
    const result = await glideTracerTool.handler({
      action: "trace",
      workspace: tmpRoot,
      agent_id: "ghost",
    });
    expect(JSON.parse(textOf(result))).toMatchObject({
      ok: false,
      error: "Agent not found: ghost",
    });
  });

  it("produces indepth markdown", async () => {
    writeAgent(tmpRoot, "root");
    const result = await glideTracerTool.handler({
      action: "indepth",
      workspace: tmpRoot,
      agent_id: "root",
    });
    expect(textOf(result)).toContain("# Agent: root");
  });

  it("rejects unsupported actions", async () => {
    await expect(
      glideTracerTool.handler({
        action: "explode",
        workspace: tmpRoot,
        agent_id: "root",
      })
    ).rejects.toThrow("Unsupported tracer action: explode");
  });

  it("rejects missing args", async () => {
    await expect(glideTracerTool.handler({ action: "trace" })).rejects.toThrow(
      "action, workspace, and agent_id are required"
    );
  });
});

describe("glide_trace", () => {
  const tmpRoot = "/tmp/glide-trace-tool-test";

  beforeEach(() => {
    if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true });
    mkdirSync(tmpRoot, { recursive: true });
  });

  it("returns the agent chain with parent links", async () => {
    writeAgent(tmpRoot, "root");
    writeAgent(tmpRoot, "kid", "root");
    const result = await glideTraceTool.handler({
      workspace: tmpRoot,
      agent_id: "kid",
    });
    const parsed = JSON.parse(textOf(result));
    expect(parsed.ok).toBe(true);
    expect(parsed.tool).toBe("glide_trace");
    expect(parsed.agent_id).toBe("kid");
    expect(parsed.file_path).toBeNull();
    expect(parsed.line).toBeNull();
    expect(parsed.trace.chain).toEqual([]);
  });

  it("rejects missing args", async () => {
    await expect(glideTraceTool.handler({})).rejects.toThrow(
      "workspace and agent_id are required"
    );
  });
});

describe("glide_indepth", () => {
  const tmpRoot = "/tmp/glide-indepth-tool-test";

  beforeEach(() => {
    if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true });
    mkdirSync(tmpRoot, { recursive: true });
  });

  it("writes the indepth markdown file", async () => {
    writeAgent(tmpRoot, "root");
    const result = await glideIndepthTool.handler({
      workspace: tmpRoot,
      agent_id: "root",
      output_dir: join(tmpRoot, "out"),
    });
    const parsed = JSON.parse(textOf(result));
    expect(parsed.ok).toBe(true);
    expect(parsed.path).toBe(join(tmpRoot, "out", "root.md"));
    expect(existsSync(parsed.path)).toBe(true);
    expect(readFileSync(parsed.path, "utf8")).toContain("# Agent: root");
  });

  it("defaults output dir under the workspace", async () => {
    writeAgent(tmpRoot, "root");
    const result = await glideIndepthTool.handler({
      workspace: tmpRoot,
      agent_id: "root",
    });
    const parsed = JSON.parse(textOf(result));
    expect(parsed.path).toBe(join(tmpRoot, "runtime", "root.md"));
    expect(existsSync(parsed.path)).toBe(true);
  });

  it("rejects missing args", async () => {
    await expect(glideIndepthTool.handler({})).rejects.toThrow(
      "workspace and agent_id are required"
    );
  });
});
