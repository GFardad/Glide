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
export const glideBuildTool = {
    name: "glide_build",
    description: "Record a build artifact for a campaign",
    inputSchema: {
        type: "object",
        properties: {
            campaign_dir: { type: "string" },
            team: { type: "string" },
            status: { type: "string" },
            notes: { type: "string" },
        },
        required: ["campaign_dir"],
    },
    handler: async (args) => {
        const campaignDir = args["campaign_dir"];
        if (typeof campaignDir !== "string" || !campaignDir.trim()) {
            throw new Error("campaign_dir is required");
        }
        const team = args["team"] ?? "unknown";
        const status = args["status"] ?? "pending";
        const notes = args["notes"] ?? "";
        if (typeof campaignDir !== "string") {
            throw new Error("campaign_dir is required");
        }
        guardWorkspace(campaignDir);
        const planDir = ensurePlanDir(campaignDir);
        const path = nextArtifactPath(planDir, "build");
        const body = [
            "# Build",
            "",
            "## Team",
            team,
            "",
            "## Status",
            status,
            "",
            "## Notes",
            notes || "No notes.",
            "",
            "## Artifacts",
            "- TBD",
        ].join("\n");
        writeFileSync(path, body);
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        ok: true,
                        tool: "glide_build",
                        campaign_dir: campaignDir,
                        path,
                    }),
                },
            ],
        };
    },
};
//# sourceMappingURL=glide-build.js.map