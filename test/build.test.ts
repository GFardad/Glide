import { describe, it, expect, beforeEach } from "vitest";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createCampaign } from "../packages/core/src/campaign/index.js";
import { glideBuildTool } from "../packages/mcp-server/src/tools/glide-build.js";

describe("glide_build tool", () => {
  const tmpRoot = "/tmp/glide-build-test";

  beforeEach(() => {
    if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true });
    mkdirSync(tmpRoot, { recursive: true });
  });

  it("creates a build artifact inside the campaign plan dir", async () => {
    const root = join(tmpRoot, "campaign");
    createCampaign(root, "Build API", [], []);
    const result = await glideBuildTool.handler({
      campaign_dir: root,
      team: "backend",
      status: "green",
      notes: "All green",
    });
    const text = (result.content[0] as { type: "text"; text: string }).text;
    const parsed = JSON.parse(text);

    expect(parsed.ok).toBe(true);
    expect(parsed.tool).toBe("glide_build");
    expect(existsSync(parsed.path)).toBe(true);
    expect(parsed.path).toContain(join(root, "plan"));
  });

  it("rejects missing campaign_dir", async () => {
    await expect(() =>
      glideBuildTool.handler({ campaign_dir: "" })
    ).rejects.toThrow("campaign_dir is required");
  });
});
