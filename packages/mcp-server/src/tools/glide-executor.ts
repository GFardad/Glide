import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { GlideTool } from "./types.js";
import type { AgentContext } from "@glide/executor";
import {
  ensureAgentContract,
  appendNote,
  markTodoDone,
  recordRejection,
  listAgents,
} from "@glide/executor";

export const glideExecutorTool: GlideTool = {
  name: "glide_executor",
  description: "Execute an agent task using the executor runtime",
  inputSchema: {
    type: "object",
    properties: {
      workspace: { type: "string" },
      agent_id: { type: "string" },
      action: {
        type: "string",
        enum: [
          "ensure_contract",
          "append_note",
          "mark_todo_done",
          "record_rejection",
          "list_agents",
        ],
      },
      payload: { type: "object" },
    },
    required: ["workspace", "agent_id", "action"],
  },
  allowedRoles: ["Engineer", "Security"],
  requiredScopes: ["executor", "runtime"],
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const workspace = args["workspace"];
    const agentId = args["agent_id"];
    const action = args["action"];
    const payload =
      (args["payload"] as Record<string, unknown> | undefined) ?? {};

    if (
      typeof workspace !== "string" ||
      typeof agentId !== "string" ||
      typeof action !== "string"
    ) {
      throw new Error("workspace, agent_id, and action are required");
    }

    switch (action) {
      case "ensure_contract": {
        const sessionId =
          (payload.session_id as string | undefined) ?? `s_${agentId}`;
        const teamId = payload.team_id as string | undefined;
        const parentId = payload.parent_id as string | undefined;
        const context: AgentContext = { sessionId, agentId, cwd: workspace };
        if (teamId !== undefined) context.teamId = teamId;
        if (parentId !== undefined) context.parentId = parentId;
        ensureAgentContract(workspace, context);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ok: true, action, agent_id: agentId }),
            },
          ],
        };
      }
      case "append_note": {
        const message = (payload.message as string | undefined) ?? "";
        appendNote(workspace, agentId, message);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ok: true, action, agent_id: agentId }),
            },
          ],
        };
      }
      case "mark_todo_done": {
        const todo = (payload.todo as string | undefined) ?? "";
        markTodoDone(workspace, agentId, todo);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ok: true,
                action,
                agent_id: agentId,
                todo,
              }),
            },
          ],
        };
      }
      case "record_rejection": {
        const item = (payload.item as string | undefined) ?? "";
        const reason = (payload.reason as string | undefined) ?? "";
        recordRejection(
          workspace,
          agentId,
          item,
          reason,
          (payload.rejected_by as string | undefined) ?? "runtime"
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ok: true,
                action,
                agent_id: agentId,
                item,
              }),
            },
          ],
        };
      }
      case "list_agents": {
        const agents = listAgents(workspace);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ok: true, action, agents }),
            },
          ],
        };
      }
      default:
        throw new Error(`Unknown executor action: ${action}`);
    }
  },
};
