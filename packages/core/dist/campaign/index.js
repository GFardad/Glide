import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { CampaignNotFoundError } from "../errors/index.js";
const CAMPAIGN_FILE = "campaign.json";
export function createCampaign(root, goal, nonGoals, assumptions) {
    const id = generateCampaignId();
    const campaign = {
        id,
        root,
        goal,
        nonGoals,
        assumptions,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    ensureCampaignDir(root);
    writeFileSync(join(root, CAMPAIGN_FILE), JSON.stringify(campaign, null, 2));
    writeFileSync(join(root, "GOAL.md"), formatMarkdown("Goal", goal));
    writeFileSync(join(root, "NON_GOALS.md"), formatMarkdown("Non-Goals", nonGoals.join("\n")));
    writeFileSync(join(root, "ASSUMPTIONS.md"), formatMarkdown("Assumptions", assumptions.join("\n")));
    return campaign;
}
export function loadCampaign(root) {
    const path = join(root, CAMPAIGN_FILE);
    if (!existsSync(path)) {
        throw new CampaignNotFoundError(root);
    }
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    }
    catch (error) {
        throw new Error(`Failed to parse campaign at ${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
}
export function ensureCampaignDir(root) {
    mkdirSync(root, { recursive: true });
    mkdirSync(join(root, "sessions"), { recursive: true });
    mkdirSync(join(root, "artifacts"), { recursive: true });
}
function generateCampaignId() {
    return `camp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function formatMarkdown(title, body) {
    return `# ${title}\n\n${body}\n`;
}
//# sourceMappingURL=index.js.map