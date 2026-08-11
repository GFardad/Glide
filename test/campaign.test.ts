import { describe, it, expect, beforeEach } from "vitest";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  createCampaign,
  loadCampaign,
} from "../packages/core/src/campaign/index.js";

describe("campaign contract", () => {
  const tmpRoot = "/tmp/glide-campaign-test";

  beforeEach(() => {
    if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true });
    mkdirSync(tmpRoot, { recursive: true });
  });

  it("creates campaign files and directory structure", () => {
    const root = join(tmpRoot, "c1");
    const campaign = createCampaign(
      root,
      "Build a CLI",
      ["UI"],
      ["models available"]
    );
    expect(campaign.goal).toBe("Build a CLI");
    expect(campaign.nonGoals).toEqual(["UI"]);
    expect(campaign.assumptions).toEqual(["models available"]);
    expect(existsSync(join(root, "GOAL.md"))).toBe(true);
    expect(existsSync(join(root, "NON_GOALS.md"))).toBe(true);
    expect(existsSync(join(root, "ASSUMPTIONS.md"))).toBe(true);
    expect(existsSync(join(root, "sessions"))).toBe(true);
    expect(existsSync(join(root, "artifacts"))).toBe(true);
  });

  it("loads an existing campaign", () => {
    const root = join(tmpRoot, "c2");
    const created = createCampaign(
      root,
      "Build API",
      ["Mobile"],
      ["auth exists"]
    );
    const loaded = loadCampaign(root);
    expect(loaded.id).toBe(created.id);
    expect(loaded.goal).toBe("Build API");
    expect(loaded.nonGoals).toEqual(["Mobile"]);
  });
});
