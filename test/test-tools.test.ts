import { describe, it, expect, beforeEach } from "vitest";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createCampaign } from "../packages/core/src/campaign/index.js";
import { glideTestTool } from "../packages/mcp-server/src/tools/glide-test-tools.js";

describe("glide_test tool", () => {
  const tmpRoot = "/tmp/glide-test-tool-test";

  beforeEach(() => {
    if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true });
    mkdirSync(tmpRoot, { recursive: true });
  });

  it("creates a test artifact inside the campaign plan dir", async () => {
    const root = join(tmpRoot, "campaign");
    createCampaign(root, "Test suite", [], []);
    const result = await glideTestTool.handler({
      campaign_dir: root,
      team: "qa",
      passed: true,
      summary: "All tests passed",
    });
    const text = (result.content[0] as { type: "text"; text: string }).text;
    const parsed = JSON.parse(text);

    expect(parsed.ok).toBe(true);
    expect(parsed.tool).toBe("glide_test");
    expect(existsSync(parsed.path)).toBe(true);
    expect(parsed.path).toContain(join(root, "plan"));
  });

  it("rejects missing campaign_dir", async () => {
    await expect(() =>
      glideTestTool.handler({ campaign_dir: "" })
    ).rejects.toThrow("campaign_dir is required");
  });
});
