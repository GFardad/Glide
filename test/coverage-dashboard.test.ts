import { describe, it, expect, beforeEach } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
// Import through the package barrel so src/index.ts re-exports are covered.
import {
  generateDashboard,
  listCampaigns,
  loadCampaign,
  renderHtml,
} from "../packages/dashboard/src/index.js";

/**
 * Coverage gap tests for packages/dashboard/src — complements
 * test/dashboard.test.ts by importing through the barrel and covering
 * renderHtml/listCampaigns/loadCampaign error paths.
 */
describe("dashboard barrel and render", () => {
  const tmpRoot = "/tmp/glide-dashboard-src-test";

  beforeEach(() => {
    if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true });
    mkdirSync(tmpRoot, { recursive: true });
  });

  function writeCampaign(id: string, goal: string, updatedAt: string) {
    const root = join(tmpRoot, id);
    mkdirSync(join(root, "artifacts"), { recursive: true });
    mkdirSync(join(root, "sessions"), { recursive: true });
    writeFileSync(
      join(root, "campaign.json"),
      JSON.stringify({
        campaign: {
          id,
          root,
          goal,
          nonGoals: [],
          assumptions: [],
          createdAt: updatedAt,
          updatedAt,
        },
      })
    );
    writeFileSync(join(root, "artifacts", "plan.md"), "# plan");
    writeFileSync(join(root, "artifacts", "role_analysis.json"), "{}");
    writeFileSync(join(root, "sessions", "s1.json"), "{}");
    return root;
  }

  it("loadCampaign reads campaign.json", () => {
    const root = writeCampaign("c1", "Build CLI", "2026-01-01T00:00:00.000Z");
    const campaign = loadCampaign(root);
    expect(campaign.id).toBe("c1");
    expect(campaign.goal).toBe("Build CLI");
  });

  it("loadCampaign throws when campaign.json is missing", () => {
    expect(() => loadCampaign(join(tmpRoot, "missing"))).toThrow(
      "Campaign not found"
    );
  });

  it("listCampaigns filters roots without campaign.json and sorts by updatedAt", () => {
    writeCampaign("old", "Old goal", "2026-01-01T00:00:00.000Z");
    writeCampaign("new", "New goal", "2026-06-01T00:00:00.000Z");
    mkdirSync(join(tmpRoot, "not-a-campaign"), { recursive: true });

    const listings = listCampaigns([
      join(tmpRoot, "old"),
      join(tmpRoot, "new"),
      join(tmpRoot, "not-a-campaign"),
    ]);

    expect(listings.map((l) => l.id)).toEqual(["new", "old"]);
    expect(listings[0]?.artifactCount).toBe(1); // role_analysis.json filtered
    expect(listings[0]?.sessionCount).toBe(1);
  });

  it("generateDashboard returns campaigns and generatedAt", () => {
    const root = writeCampaign("c2", "G", "2026-01-01T00:00:00.000Z");
    const view = generateDashboard([root]);
    expect(view.campaigns).toHaveLength(1);
    expect(view.generatedAt).toBeInstanceOf(Date);
  });

  it("generateDashboard handles missing artifacts and sessions dirs", () => {
    const root = writeCampaign("bare", "Bare campaign", "2026-01-01T00:00:00.000Z");
    rmSync(join(root, "artifacts"), { recursive: true, force: true });
    rmSync(join(root, "sessions"), { recursive: true, force: true });
    const view = generateDashboard([root]);
    expect(view.campaigns[0]?.artifactCount).toBe(0);
    expect(view.campaigns[0]?.sessionCount).toBe(0);
  });

  it("renderHtml embeds campaigns and generatedAt", () => {
    const root = writeCampaign("c3", "Render", "2026-02-02T00:00:00.000Z");
    const html = renderHtml(generateDashboard([root]));
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Glide Dashboard");
    expect(html).toContain('"id": "c3"');
    expect(html).toContain("__GLIDE_DASHBOARD__");
  });
});
