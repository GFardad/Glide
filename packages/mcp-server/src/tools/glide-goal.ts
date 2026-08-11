import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { GlideTool } from "./types.js";
import { createCampaign, loadCampaign } from "@glide/core";

export const glideGoalSetTool: GlideTool = {
  name: "glide_goal_set",
  description: "Set the primary goal for a Glide campaign",
  inputSchema: {
    type: "object",
    properties: {
      campaign_dir: { type: "string" },
      goal: { type: "string" },
    },
    required: ["campaign_dir", "goal"],
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const campaign_dir = args["campaign_dir"];
    const goal = args["goal"];
    if (typeof campaign_dir !== "string" || typeof goal !== "string") {
      throw new Error("campaign_dir and goal are required");
    }
    const campaign = createCampaign(campaign_dir, goal, [], []);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            ok: true,
            campaign_id: campaign.id,
            campaign_dir,
            goal,
          }),
        },
      ],
    };
  },
};

export const glideGoalGetTool: GlideTool = {
  name: "glide_goal_get",
  description: "Get the primary goal for a Glide campaign",
  inputSchema: {
    type: "object",
    properties: {
      campaign_dir: { type: "string" },
    },
    required: ["campaign_dir"],
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const campaign_dir = args["campaign_dir"];
    if (typeof campaign_dir !== "string") {
      throw new Error("campaign_dir is required");
    }
    const campaign = loadCampaign(campaign_dir);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            ok: true,
            campaign_id: campaign.id,
            campaign_dir,
            goal: campaign.goal,
          }),
        },
      ],
    };
  },
};
