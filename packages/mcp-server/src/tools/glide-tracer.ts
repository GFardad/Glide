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
    const action = args["action"];
    const workspace = args["workspace"];
    const agentId = args["agent_id"];

    if (
      typeof action !== "string" ||
      typeof workspace !== "string" ||
      typeof agentId !== "string"
    ) {
      throw new Error("action, workspace, and agent_id are required");
    }

    if (action === "trace") {
      try {
        const trace = traceAgent({ workspace, agentId });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ok: true,
                action,
                agent_id: trace.agentId,
                goal: trace.goal,
                notes: trace.notes,
                todos: trace.todos,
                parent_id: trace.parentId,
                children: trace.children,
              }),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ok: false,
                action,
                agent_id: agentId,
                error: error instanceof Error ? error.message : "unknown error",
              }),
            },
          ],
        };
      }
    }

    if (action === "indepth") {
      const md = indepthAgent({ workspace, agentId });
      return { content: [{ type: "text", text: md }] };
    }

    throw new Error(`Unsupported tracer action: ${action}`);
  },
};
