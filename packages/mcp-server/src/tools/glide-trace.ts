import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { GlideTool } from "./types.js";

export const glideTraceTool: GlideTool = {
  name: "glide_trace",
  description: "Trace a code line or agent upward to Headroom, returning the agent chain",
  inputSchema: {
    type: "object",
    properties: {
      workspace: { type: "string" },
      agent_id: { type: "string" },
      file_path: { type: "string" },
      line: { type: "number" },
    },
    required: ["workspace", "agent_id"],
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const workspace = args["workspace"];
    const agentId = args["agent_id"];
    if (typeof workspace !== "string" || typeof agentId !== "string") {
      throw new Error("workspace and agent_id are required");
    }
    return {
      content: [{ type: "text", text: JSON.stringify({ ok: true, tool: "glide_trace", agent_id: agentId, file_path: null, line: null, trace: { chain: [] } }) }],
    };
  },
};
