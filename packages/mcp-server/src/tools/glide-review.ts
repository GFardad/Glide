import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { GlideTool } from "./types.js";
import { createPathGuard } from "@glide/core";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const guardWorkspace = createPathGuard({
  allowedRoots: [process.cwd(), "/tmp"],
  requireExists: true,
});

function ensurePlanDir(campaignDir: string): string {
  const planDir = join(campaignDir, "plan");
  mkdirSync(planDir, { recursive: true });
  return planDir;
}

function nextArtifactPath(planDir: string, prefix: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return join(planDir, `${prefix}_${timestamp}.md`);
}

export const glideReviewTool: GlideTool = {
  name: "glide_review",
  description: "Record a review artifact for a campaign",
  inputSchema: {
    type: "object",
    properties: {
      campaign_dir: { type: "string" },
      reviewer: { type: "string" },
      decision: { type: "string" },
      notes: { type: "string" },
    },
    required: ["campaign_dir", "decision"],
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const campaignDir = args["campaign_dir"];
    const reviewer = (args["reviewer"] as string | undefined) ?? "unknown";
    const decision = args["decision"];
    const notes = (args["notes"] as string | undefined) ?? "";

    if (
      typeof campaignDir !== "string" ||
      typeof decision !== "string" ||
      !campaignDir.trim() ||
      !decision.trim()
    ) {
      throw new Error("campaign_dir and decision are required");
    }

    guardWorkspace(campaignDir);

    const planDir = ensurePlanDir(campaignDir);
    const path = nextArtifactPath(planDir, "review");

    const body = [
      "# Review",
      "",
      "## Reviewer",
      reviewer,
      "",
      "## Decision",
      decision,
      "",
      "## Notes",
      notes || "No notes.",
    ].join("\n");

    writeFileSync(path, body);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            ok: true,
            tool: "glide_review",
            campaign_dir: campaignDir,
            path,
          }),
        },
      ],
    };
  },
};
