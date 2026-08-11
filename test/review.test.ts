import { describe, it, expect, beforeEach } from "vitest";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createCampaign } from "../packages/core/src/campaign/index.js";
import { glideReviewTool } from "../packages/mcp-server/src/tools/glide-review.js";

describe("glide_review tool", () => {
  const tmpRoot = "/tmp/glide-review-test";

  beforeEach(() => {
    if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true });
    mkdirSync(tmpRoot, { recursive: true });
  });

  it("creates a review artifact inside the campaign plan dir", async () => {
    const root = join(tmpRoot, "campaign");
    createCampaign(root, "Review PR", [], []);
    const result = await glideReviewTool.handler({
      campaign_dir: root,
      reviewer: "alice",
      decision: "approved",
      notes: "Looks good",
    });
    const text = (result.content[0] as { type: "text"; text: string }).text;
    const parsed = JSON.parse(text);

    expect(parsed.ok).toBe(true);
    expect(parsed.tool).toBe("glide_review");
    expect(existsSync(parsed.path)).toBe(true);
    expect(parsed.path).toContain(join(root, "plan"));
  });

  it("rejects missing required fields", async () => {
    await expect(() =>
      glideReviewTool.handler({ campaign_dir: "", decision: "" })
    ).rejects.toThrow("campaign_dir and decision are required");
  });
});
