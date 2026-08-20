import { GraphifyClient } from "@glide/tracer";
export const glideStatusTool = {
    name: "glide_status",
    description: "Get overall Glide system status",
    inputSchema: {
        type: "object",
        properties: {
            project_path: { type: "string" },
        },
    },
    handler: async (args) => {
        const projectPath = args["project_path"];
        const status = {
            status: "ok",
            version: "0.1.0",
            phase: "1-2",
        };
        if (typeof projectPath === "string" && projectPath.length > 0) {
            try {
                const client = new GraphifyClient({ projectPath });
                const graph = client.read();
                status.graphify = {
                    node_count: graph.nodes.length,
                    edge_count: graph.links.length,
                    communities: Array.from(new Set(graph.nodes
                        .map((n) => n.community)
                        .filter((c) => typeof c === "number"))).sort((a, b) => a - b),
                };
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                status.graphify = {
                    available: false,
                    error: message,
                };
            }
        }
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(status),
                },
            ],
        };
    },
};
//# sourceMappingURL=glide-status.js.map