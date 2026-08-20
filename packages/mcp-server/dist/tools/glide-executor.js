import { ensureAgentContract, appendNote, markTodoDone, recordRejection, listAgents, } from "@glide/executor";
export const glideExecutorTool = {
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
    handler: async (args) => {
        const workspace = args["workspace"];
        const agentId = args["agent_id"];
        const action = args["action"];
        const payload = args["payload"] ?? {};
        if (typeof workspace !== "string" ||
            typeof agentId !== "string" ||
            typeof action !== "string") {
            throw new Error("workspace, agent_id, and action are required");
        }
        switch (action) {
            case "ensure_contract": {
                const sessionId = payload.session_id ?? `s_${agentId}`;
                const teamId = payload.team_id;
                const parentId = payload.parent_id;
                const context = { sessionId, agentId, cwd: workspace };
                if (teamId !== undefined)
                    context.teamId = teamId;
                if (parentId !== undefined)
                    context.parentId = parentId;
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
                const message = payload.message ?? "";
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
                const todo = payload.todo ?? "";
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
                const item = payload.item ?? "";
                const reason = payload.reason ?? "";
                recordRejection(workspace, agentId, item, reason, payload.rejected_by ?? "runtime");
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
//# sourceMappingURL=glide-executor.js.map