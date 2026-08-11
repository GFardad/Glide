import { describe, it, expect, beforeEach } from "vitest";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { glideIndepthTool } from "../packages/mcp-server/dist/tools/glide-indepth.js";

describe("glide_indepth tool", () => {
  const tmpRoot = "/tmp/glide-indepth-test";

  beforeEach(() => {
    if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true });
    mkdirSync(tmpRoot, { recursive: true });
  });

  it("writes indepth markdown and returns path", async () => {
    const workspace = join(tmpRoot, "ws");
    const agentId = "agent-1";
    const agentDir = join(workspace, "agents", agentId);
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(join(agentDir, "GOAL.md"), "# Goal\n\nIndepth test\n");
    writeFileSync(
      join(agentDir, "PERSONALITY.md"),
      "# Personality\n\nParent: none\n"
    );
    writeFileSync(join(agentDir, "NOTES.md"), "- note");
    writeFileSync(join(agentDir, "TODO.md"), "- todo");

    const result = await glideIndepthTool.handler({
      workspace,
      agent_id: agentId,
    });
    const text = (result.content[0] as { type: string; text: string }).text;
    const parsed = JSON.parse(text);
    expect(parsed.ok).toBe(true);
    expect(parsed.agent_id).toBe(agentId);
    expect(parsed.path).toContain(`${agentId}.md`);
    expect(existsSync(parsed.path)).toBe(true);
  });

  it("rejects missing required fields", async () => {
    await expect(
      glideIndepthTool.handler({ workspace: "/tmp" } as Record<string, unknown>)
    ).rejects.toThrow("workspace and agent_id are required");
  });
});
