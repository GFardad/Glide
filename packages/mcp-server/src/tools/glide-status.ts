import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { GlideTool } from "./types.js";

export const glideStatusTool: GlideTool = {
  name: "glide_status",
  description: "Get overall Glide system status",
  inputSchema: { type: "object", properties: {} },
  handler: async (): Promise<CallToolResult> => {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "ok",
            version: "0.1.0",
            phase: "1-2",
          }),
        },
      ],
    };
  },
};
