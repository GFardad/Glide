import { describe, it, expect, beforeEach } from "vitest";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { glideHeadroomTool } from "../packages/mcp-server/src/tools/glide-headroom.js";

type ToolResponse = {
  content: { type: string; text: string }[];
  isError?: boolean;
};

function textOf(resp: ToolResponse): string {
  const block = resp.content[0];
  if (block?.type !== "text") throw new Error("expected text content block");
  return block.text;
}

describe("glide_headroom approval gate", () => {
  const tmpRoot = "/tmp/glide-headroom-approval-test";

  beforeEach(() => {
    if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true });
    mkdirSync(tmpRoot, { recursive: true });
  });

  it("rejects when campaign contract files are missing", async () => {
    const campaignDir = join(tmpRoot, "incomplete");
    mkdirSync(campaignDir, { recursive: true });
    writeFileSync(join(campaignDir, "campaign.json"), "{}", "utf8");

    const resp = (await glideHeadroomTool.handler({
      campaign_dir: campaignDir,
      objective: "Build CLI",
    })) as ToolResponse;

    expect(resp.isError).toBe(true);
    const parsed = JSON.parse(textOf(resp));
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("approval_gate");
    expect(parsed.missing_artifacts).toEqual(
      expect.arrayContaining(["GOAL.md", "NON_GOALS.md", "ASSUMPTIONS.md"])
    );
  });

  it("allows headroom when all contract files exist", async () => {
    const campaignDir = join(tmpRoot, "complete");
    mkdirSync(campaignDir, { recursive: true });
    writeFileSync(join(campaignDir, "GOAL.md"), "# Goal\nBuild CLI", "utf8");
    writeFileSync(
      join(campaignDir, "NON_GOALS.md"),
      "# Non-Goals\nnone",
      "utf8"
    );
    writeFileSync(
      join(campaignDir, "ASSUMPTIONS.md"),
      "# Assumptions\nall good",
      "utf8"
    );

    const resp = (await glideHeadroomTool.handler({
      campaign_dir: campaignDir,
      objective: "Build CLI",
    })) as ToolResponse;

    expect(resp.isError).toBeUndefined();
    const parsed = JSON.parse(textOf(resp));
    expect(parsed.ok).toBe(true);
    expect(parsed.campaign_dir).toBe(campaignDir);
  });
});
