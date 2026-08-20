import { buildIcmCampaign, runWalkTest } from "@glide/headroom";
export const glideIcmTool = {
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
    handler: async (args) => {
        const root = args.root;
        const action = args.action;
        const id = args.id;
        const goal = args.goal;
        const stages = args.stages ?? undefined;
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
            });
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
//# sourceMappingURL=glide-icm.js.map