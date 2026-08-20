import { GraphifyClient } from "@glide/tracer";
import { runHeadroom } from "@glide/headroom";
import { GateLifecycle } from "@glide/permissions";
export const glideDashboardTool = {
    name: "glide_dashboard",
    description: "CEO dashboard: aggregate Glide system health from status, graph, headroom, and gates into one view.",
    allowedRoles: ["CEO", "Architect", "Product"],
    requiredScopes: ["dashboard", "status", "graph"],
    inputSchema: {
        type: "object",
        properties: {
            project_path: { type: "string" },
            campaign_dir: { type: "string" },
            objective: { type: "string" },
            roles: { type: "array", items: { type: "string" } },
            subject_role: { type: "string" },
        },
        required: ["project_path"],
    },
    handler: async (args) => {
        const projectPath = args.project_path;
        const campaignDir = args.campaign_dir;
        const objective = args.objective;
        const roles = args.roles ?? ["CEO"];
        if (!projectPath || projectPath.length === 0) {
            return {
                content: [{ type: "text", text: JSON.stringify({ ok: false, error: "project_path is required" }) }],
                isError: true,
            };
        }
        const payload = {
            ok: true,
            project_path: projectPath,
            generatedAt: new Date().toISOString(),
            ceoRoleIncluded: roles.includes("CEO"),
        };
        try {
            const status = {
                status: "ok",
                version: "0.1.0",
                phase: "1-2",
            };
            try {
                const client = new GraphifyClient({ projectPath });
                const graph = client.read();
                const normalizedCommunities = Array.from(new Set(graph.nodes
                    .map((node) => node.community)
                    .filter((community) => typeof community === "number"))).sort((a, b) => a - b);
                status.graphify = {
                    node_count: graph.nodes.length,
                    edge_count: graph.links.length,
                    communities: normalizedCommunities,
                };
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                status.graphify = { available: false, error: message };
            }
            payload.status = status;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            payload.status = { ok: false, error: message };
        }
        if (campaignDir && objective) {
            try {
                const headroom = await runHeadroom({ campaignDir, objective, roles });
                payload.headroom = {
                    campaign_id: headroom.campaign.id,
                    drift_detected: headroom.driftDetected,
                    roles: roles.length > 0 ? roles : ["CEO"],
                };
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                payload.headroom = { ok: false, error: message };
            }
        }
        try {
            const lifecycle = new GateLifecycle(projectPath);
            payload.gates = lifecycle.run();
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            payload.gates = { ok: false, error: message };
        }
        return {
            content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        };
    },
};
//# sourceMappingURL=glide-dashboard.js.map