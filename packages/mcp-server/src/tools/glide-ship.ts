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

export const glideShipTool: GlideTool = {
  name: "glide_ship",
  description: "Record a ship artifact for a campaign",
  inputSchema: {
    type: "object",
    properties: {
      campaign_dir: { type: "string" },
      target: { type: "string" },
      status: { type: "string" },
      notes: { type: "string" },
    },
    required: ["campaign_dir", "target"],
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const campaignDir = args["campaign_dir"];
    const target = args["target"];
    if (
      typeof campaignDir !== "string" ||
      !campaignDir.trim() ||
      typeof target !== "string" ||
      !target.trim()
    ) {
      throw new Error("campaign_dir and target are required");
    }
    const status = (args["status"] as string | undefined) ?? "shipped";
    const notes = (args["notes"] as string | undefined) ?? "";

    if (typeof campaignDir !== "string" || typeof target !== "string") {
      throw new Error("campaign_dir and target are required");
    }

    guardWorkspace(campaignDir);

    const planDir = ensurePlanDir(campaignDir);
    const path = nextArtifactPath(planDir, "ship");

    const body = [
      "# Ship",
      "",
      "## Target",
      target,
      "",
      "## Status",
      status,
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
            tool: "glide_ship",
            campaign_dir: campaignDir,
            path,
          }),
        },
      ],
    };
  },
};
