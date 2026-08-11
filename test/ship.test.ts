import { describe, it, expect, beforeEach } from "vitest";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createCampaign } from "../packages/core/src/campaign/index.js";
import { glideShipTool } from "../packages/mcp-server/src/tools/glide-ship.js";

describe("glide_ship tool", () => {
  const tmpRoot = "/tmp/glide-ship-test";

  beforeEach(() => {
    if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true });
    mkdirSync(tmpRoot, { recursive: true });
  });

  it("creates a ship artifact inside the campaign plan dir", async () => {
    const root = join(tmpRoot, "campaign");
    createCampaign(root, "Ship feature", [], []);
    const result = await glideShipTool.handler({
      campaign_dir: root,
      target: "main",
      status: "shipped",
      notes: "Deployed to main",
    });
    const text = (result.content[0] as { type: "text"; text: string }).text;
    const parsed = JSON.parse(text);

    expect(parsed.ok).toBe(true);
    expect(parsed.tool).toBe("glide_ship");
    expect(existsSync(parsed.path)).toBe(true);
    expect(parsed.path).toContain(join(root, "plan"));
  });

  it("rejects missing required fields", async () => {
    await expect(() =>
      glideShipTool.handler({ campaign_dir: "", target: "" })
    ).rejects.toThrow("campaign_dir and target are required");
  });
});
