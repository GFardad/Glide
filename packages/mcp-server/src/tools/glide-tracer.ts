import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { GlideTool } from "./types.js";
import { traceAgent, indepthAgent } from "@glide/tracer";

export const glideTracerTool: GlideTool = {
  name: "glide_tracer",
  description: "Trace or generate indepth markdown for a Glide agent",
  inputSchema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["trace", "indepth"] },
      workspace: { type: "string" },
      agent_id: { type: "string" },
    },
    required: ["action", "workspace", "agent_id"],
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const action = args.action as string;
    const workspace = args.workspace as string;
    const agentId = args.agent_id as string;

    if (action !== "trace" && action !== "indepth") {
      throw new Error(`Unsupported tracer action: ${action}`);
    }

    if (!action || !workspace || !agentId) {
      throw new Error("action, workspace, and agent_id are required");
    }

    try {
      if (action === "trace") {
        const trace = await traceAgent({ workspace, agentId });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ok: true,
                agent_id: agentId,
                goal: trace.goal,
                notes: trace.notes,
                tool: "glide_tracer",
              }),
            },
          ],
        };
      }

      const md = await indepthAgent({ workspace, agentId });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ ok: true, action, markdown: md }),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: JSON.stringify({ ok: false, error: message }) }],
      };
    }
  },
};
