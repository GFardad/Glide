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

  it("escapes script-breaking payloads in campaign goals (XSS regression)", async () => {
    const root = join(tmpRoot, "xss");
    createCampaign(root, "</script><script>alert(1)</script>", [], []);
    const view = generateDashboard([root]);
    const html = renderHtml(view);

    // The raw HTML/script sequence must never appear unescaped.
    expect(html).not.toContain("</script><script>alert(1)");
    // The safe `<` → \u003c serialization must carry the payload inertly.
    expect(html).toContain("\\u003c/script\\u003e\\u003cscript\\u003e");
  });

  it("escapes HTML entities and ampersands in campaign goals (XSS regression)", async () => {
    const root = join(tmpRoot, "xss-amp");
    createCampaign(root, "&\"'", [], []);
    const view = generateDashboard([root]);
    const html = renderHtml(view);

    expect(html).not.toContain(">alert");
    expect(html).toContain("\\u0026");
  });

  it("serializes generatedAt inside the escaped script payload, no raw interpolation", async () => {
    const root = join(tmpRoot, "c-date");
    createCampaign(root, "Dates", [], []);
    const view = generateDashboard([root]);
    const html = renderHtml(view);

    expect(html).toContain("window.__GLIDE_DASHBOARD__");
    // generatedAt must ride inside the escaped JSON, not as a separate raw string literal.
    expect(html).not.toContain('new Date("');
  });
});
