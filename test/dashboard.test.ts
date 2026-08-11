import { describe, it, expect, beforeEach } from "vitest";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createCampaign } from "../packages/core/src/campaign/index.js";
import {
  generateDashboard,
  renderHtml,
} from "../packages/dashboard/src/generator.js";

describe("dashboard surface", () => {
  const tmpRoot = "/tmp/glide-dashboard-test";

  beforeEach(() => {
    if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true });
    mkdirSync(tmpRoot, { recursive: true });
  });

  it("lists campaigns from provided roots", async () => {
    const c1 = join(tmpRoot, "c1");
    const c2 = join(tmpRoot, "c2");
    createCampaign(c1, "Build CLI", ["Mobile"], ["models available"]);
    createCampaign(c2, "Add tracing", ["UI"], ["network stable"]);

    const listings = generateDashboard([c1, c2]).campaigns;
    expect(listings).toHaveLength(2);
    const goals = listings.map((item) => item.goal).sort();
    expect(goals).toEqual(["Add tracing", "Build CLI"]);
    expect(listings.every((item) => item.artifactCount === 0)).toBe(true);
  });

  it("renders valid HTML containing campaign goal and counts", async () => {
    const root = join(tmpRoot, "c3");
    createCampaign(root, "Ship dashboard", ["Legacy UI"], ["coverage missing"]);
    const view = generateDashboard([root]);
    const html = renderHtml(view);

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<title>Glide Dashboard</title>");
    expect(html).toContain("Ship dashboard");
    expect(html).toContain("Artifacts");
    expect(html).toContain("Sessions");
    expect(html).toContain("Campaigns");
    expect(html).toContain("window.__GLIDE_DASHBOARD__");
  });

  it("returns empty dashboard when no campaigns exist", async () => {
    const view = generateDashboard([join(tmpRoot, "missing")]);
    expect(view.campaigns).toEqual([]);
    expect(view.generatedAt).toBeInstanceOf(Date);
    const html = renderHtml(view);
    expect(html).toContain("No campaigns found");
  });
});
