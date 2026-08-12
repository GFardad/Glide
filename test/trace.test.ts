import { describe, it, expect, beforeEach } from "vitest";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { glideTraceTool } from "../packages/mcp-server/dist/tools/glide-trace.js";

describe("glide_trace tool", () => {
  const tmpRoot = "/tmp/glide-trace-test";

  beforeEach(() => {
    if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true });
    mkdirSync(tmpRoot, { recursive: true });
  });

  it("returns trace chain for an agent", async () => {
    const workspace = join(tmpRoot, "ws");
    const parentDir = join(workspace, "agents", "parent");
    const childDir = join(workspace, "agents", "child");
    mkdirSync(parentDir, { recursive: true });
    mkdirSync(childDir, { recursive: true });
    writeFileSync(join(parentDir, "GOAL.md"), "# Goal\n\nParent goal\n");
    writeFileSync(
      join(parentDir, "PERSONALITY.md"),
      "# Personality\n\nParent: none\n"
    );
    writeFileSync(join(parentDir, "NOTES.md"), "");
    writeFileSync(join(parentDir, "TODO.md"), "");
    writeFileSync(join(childDir, "GOAL.md"), "# Goal\n\nChild goal\n");
    writeFileSync(
      join(childDir, "PERSONALITY.md"),
      "# Personality\n\nParent: parent\n"
    );
    writeFileSync(join(childDir, "NOTES.md"), "");
    writeFileSync(join(childDir, "TODO.md"), "");

    const result = await glideTraceTool.handler({
      workspace,
      agent_id: "child",
    });
    const text = (result.content[0] as { type: string; text: string }).text;
    const parsed = JSON.parse(text);
    expect(parsed.ok).toBe(true);
    expect(parsed.agent_id).toBe("child");
    expect(parsed.trace).toBeDefined();
  });

  it("rejects missing required fields", async () => {
    await expect(
      glideTraceTool.handler({} as Record<string, unknown>)
    ).rejects.toThrow("workspace and agent_id are required");
  });
});
