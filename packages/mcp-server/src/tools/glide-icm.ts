import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { GlideTool } from "./types.js";
import { buildIcmCampaign, runWalkTest, type IcmCampaignInput } from "@glide/headroom";

export const glideIcmTool: GlideTool = {
  name: "glide_icm",
  description: "Build or validate an ICM campaign workspace with numbered stages and walk test.",
  inputSchema: {
    type: "object",
    properties: {
      root: { type: "string" },
      id: { type: "string" },
      goal: { type: "string" },
      stages: { type: "array", items: { type: "number" } },
      action: { type: "string", enum: ["build", "walk_test"] },
    },
    required: ["root", "action"],
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const root = args.root as string;
    const action = args.action as string;
    const id = args.id as string | undefined;
    const goal = args.goal as string | undefined;
    const stages = (args.stages as number[] | undefined) ?? undefined;

    if (!root || root.length === 0) {
      return {
        content: [{ type: "text", text: JSON.stringify({ ok: false, error: "root is required" }) }],
        isError: true,
      };
    }

    if (action === "build") {
      const result = buildIcmCampaign({
        root,
        ...(typeof id === "string" ? { id } : {}),
        ...(typeof goal === "string" ? { goal } : {}),
        ...(Array.isArray(stages) ? { stages } : {}),
      } as IcmCampaignInput);
      return {
        content: [{ type: "text", text: JSON.stringify({ ok: true, action, ...result }) }],
      };
    }

    if (action === "walk_test") {
      const walkTest = runWalkTest(root);
      return {
        content: [{ type: "text", text: JSON.stringify({ ok: true, action, root, walkTest }) }],
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify({ ok: false, error: `Unsupported action: ${action}` }) }],
      isError: true,
    };
  },
};
