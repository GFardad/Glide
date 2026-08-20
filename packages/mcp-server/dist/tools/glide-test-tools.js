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
export const glideTestTool = {
    name: "glide_test",
    description: "Record a test artifact for a campaign",
    inputSchema: {
        type: "object",
        properties: {
            campaign_dir: { type: "string" },
            team: { type: "string" },
            passed: { type: "boolean" },
            summary: { type: "string" },
        },
        required: ["campaign_dir"],
    },
    handler: async (args) => {
        const campaignDir = args["campaign_dir"];
        if (typeof campaignDir !== "string" || !campaignDir.trim()) {
            throw new Error("campaign_dir is required");
        }
        const team = args["team"] ?? "unknown";
        const passed = args["passed"] ?? false;
        const summary = args["summary"] ?? "";
        if (typeof campaignDir !== "string") {
            throw new Error("campaign_dir is required");
        }
        guardWorkspace(campaignDir);
        const planDir = ensurePlanDir(campaignDir);
        const path = nextArtifactPath(planDir, "test");
        const body = [
            "# Test",
            "",
            "## Team",
            team,
            "",
            "## Result",
            passed ? "passed" : "failed",
            "",
            "## Summary",
            summary || "No summary provided.",
        ].join("\n");
        writeFileSync(path, body);
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        ok: true,
                        tool: "glide_test",
                        campaign_dir: campaignDir,
                        path,
                    }),
                },
            ],
        };
    },
};
//# sourceMappingURL=glide-test-tools.js.map