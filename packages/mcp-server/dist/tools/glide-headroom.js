import { runHeadroom } from "@glide/headroom";
import { existsSync } from "node:fs";
import { join } from "node:path";
const REQUIRED_CONTRACT_FILES = [
    "GOAL.md",
    "NON_GOALS.md",
    "ASSUMPTIONS.md",
];
function missingContractFiles(campaignDir) {
    return REQUIRED_CONTRACT_FILES.filter((file) => !existsSync(join(campaignDir, file)));
}
export const glideHeadroomTool = {
    name: "glide_headroom",
    description: "Run a Headroom meeting with the CTO and specialist agents",
    inputSchema: {
        type: "object",
        properties: {
            campaign_dir: { type: "string" },
            objective: { type: "string" },
            roles: { type: "array", items: { type: "string" } },
        },
        required: ["campaign_dir", "objective"],
    },
    handler: async (args) => {
        const campaign_dir = args["campaign_dir"];
        const objective = args["objective"];
        const roles = args["roles"] ?? [];
        if (typeof campaign_dir !== "string" || typeof objective !== "string") {
            throw new Error("campaign_dir and objective are required");
        }
        const missing = missingContractFiles(campaign_dir);
        if (missing.length > 0) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            ok: false,
                            error: "approval_gate",
                            missing_artifacts: missing,
                            message: `Missing required campaign contract artifacts: ${missing.join(", ")}`,
                        }),
                    },
                ],
                isError: true,
            };
        }
        const result = await runHeadroom({
            campaignDir: campaign_dir,
            objective,
            roles,
        });
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        ok: true,
                        campaign_dir: result.campaign.root,
                        campaign_id: result.campaign.id,
                        objective: result.campaign.goal,
                        roles: roles.length > 0
                            ? roles
                            : ["Architect", "Engineer", "Security", "QA", "Product"],
                        artifacts: {
                            risk_log: result.riskLog,
                            architecture: result.architecture,
                            todo_registry: result.todoRegistry,
                        },
                        drift_detected: result.driftDetected,
                    }),
                },
            ],
        };
    },
};
//# sourceMappingURL=glide-headroom.js.map