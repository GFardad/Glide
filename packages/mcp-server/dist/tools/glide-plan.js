import { buildProgramTree, renderProgramMarkdown } from "@glide/executor";
import { createPathGuard } from "@glide/core";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const guardWorkspace = createPathGuard({
    allowedRoots: [process.cwd(), "/tmp"],
    requireExists: true,
});
function ensurePlanDir(campaignDir) {
    const planDir = join(campaignDir, "plan");
    mkdirSync(planDir, { recursive: true });
    return planDir;
}
function nextArtifactPath(planDir, prefix) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return join(planDir, `${prefix}_${timestamp}.md`);
}
export const glidePlanTool = {
    name: "glide_plan",
    description: "Create a plan artifact for a campaign: builds the Epic->Team->Agent " +
        "program tree from headroom artifacts and writes a structured plan with " +
        "a parent-only summary view",
    inputSchema: {
        type: "object",
        properties: {
            campaign_dir: { type: "string" },
            epic: { type: "string" },
            summary: { type: "string" },
            teams: {
                type: "array",
                items: { type: "string" },
                description: "Optional team names (replaces generated <Role> Team names)",
            },
            agents: {
                type: "array",
                items: { type: "string" },
                description: "Optional agent names; tasks are distributed across them",
            },
        },
        required: ["campaign_dir", "epic"],
    },
    handler: async (args) => {
        const campaignDir = args["campaign_dir"];
        const epic = args["epic"];
        const summary = args["summary"] ?? "";
        const teams = args["teams"];
        const agents = args["agents"];
        if (typeof campaignDir !== "string" ||
            typeof epic !== "string" ||
            !campaignDir.trim() ||
            !epic.trim()) {
            throw new Error("campaign_dir and epic are required");
        }
        guardWorkspace(campaignDir);
        const options = { campaignDir, epicName: epic };
        if (summary.trim().length > 0)
            options.epicSummary = summary;
        if (teams !== undefined)
            options.teams = teams;
        if (agents !== undefined)
            options.agents = agents;
        const tree = buildProgramTree(options);
        const planDir = ensurePlanDir(campaignDir);
        const path = nextArtifactPath(planDir, "plan");
        writeFileSync(path, renderProgramMarkdown(tree));
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        ok: true,
                        tool: "glide_plan",
                        campaign_dir: campaignDir,
                        path,
                        epic: tree.epic.name,
                        tree,
                        summary: tree.summary,
                    }),
                },
            ],
        };
    },
};
//# sourceMappingURL=glide-plan.js.map