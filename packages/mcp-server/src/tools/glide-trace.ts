import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { GlideTool } from "./types.js";
import { traceAgent } from "@glide/tracer";

export const glideTraceTool: GlideTool = {
  name: "glide_trace",
  description:
    "Trace a code line or agent upward to Headroom, returning the agent chain",
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
    const filePath = args["file_path"] as string | undefined;
    const line = args["line"] as number | undefined;

    if (typeof workspace !== "string" || typeof agentId !== "string") {
      throw new Error("workspace and agent_id are required");
    }

    const trace = traceAgent({ workspace, agentId });

    const chain: Array<Record<string, unknown>> = [];
    let current: { agentId: string; parentId: string } | undefined = {
      agentId: trace.agentId,
      parentId: trace.parentId,
    };

    while (current) {
      chain.push({
        agent_id: current.agentId,
        parent_id: current.parentId,
      });

      if (current.parentId && current.parentId !== "none") {
        current = {
          agentId: current.parentId,
          parentId: "none",
        };
      } else {
        current = undefined;
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            ok: true,
            tool: "glide_trace",
            agent_id: agentId,
            file_path: filePath ?? null,
            line: line ?? null,
            trace: {
              goal: trace.goal,
              notes: trace.notes,
              todos: trace.todos,
              children: trace.children,
              chain,
            },
          }),
        },
      ],
    };
  },
};
