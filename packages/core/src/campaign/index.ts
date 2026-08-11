import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Campaign, CampaignId } from "../types/index.js";
import { CampaignNotFoundError } from "../errors/index.js";

const CAMPAIGN_FILE = "campaign.json";

export function createCampaign(
  root: string,
  goal: string,
  nonGoals: string[],
  assumptions: string[]
): Campaign {
  const id = generateCampaignId();
  const campaign: Campaign = {
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
  writeFileSync(
    join(root, "NON_GOALS.md"),
    formatMarkdown("Non-Goals", nonGoals.join("\n"))
  );
  writeFileSync(
    join(root, "ASSUMPTIONS.md"),
    formatMarkdown("Assumptions", assumptions.join("\n"))
  );
  return campaign;
}

export function loadCampaign(root: string): Campaign {
  const path = join(root, CAMPAIGN_FILE);
  if (!existsSync(path)) {
    throw new CampaignNotFoundError(root);
  }
  return JSON.parse(readFileSync(path, "utf8")) as Campaign;
}

export function ensureCampaignDir(root: string): void {
  mkdirSync(root, { recursive: true });
  mkdirSync(join(root, "sessions"), { recursive: true });
  mkdirSync(join(root, "artifacts"), { recursive: true });
}

function generateCampaignId(): CampaignId {
  return `camp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatMarkdown(title: string, body: string): string {
  return `# ${title}\n\n${body}\n`;
}
