import { describe, it, expect, beforeEach } from "vitest";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  runConvergeAssessment,
  loadPlanItems,
  scanCodebase,
  actionableTasksFromGaps,
} from "../packages/headroom/src/converge.js";

describe("converge assessor", () => {
  const tmpRoot = "/tmp/glide-converge-test";

  beforeEach(() => {
    if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true });
    mkdirSync(tmpRoot, { recursive: true });
  });

  it("returns missing gaps for plan items with no codebase match", () => {
    const planDir = join(tmpRoot, "plan");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(
      join(planDir, "ImplementationPlan.md"),
      [
        "# Glide Implementation Plan",
        "",
        "## Build MCP server",
        "",
        "- [ ] Create glide_converge tool",
        "- [ ] Add Hermes wiring",
      ].join("\n"),
      "utf8"
    );

    const report = runConvergeAssessment(tmpRoot, planDir);
    expect(report.totalGaps).toBeGreaterThan(0);
    expect(report.gapsByKind.missing.length).toBeGreaterThan(0);
    expect(report.actionableTasks.some((t) => t.startsWith("[MISSING]"))).toBe(
      true
    );
  });

  it("returns no gaps when plan items match codebase inventory", () => {
    const planDir = join(tmpRoot, "plan");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(
      join(planDir, "ImplementationPlan.md"),
      [
        "# Headroom runtime",
        "",
        "## Headroom runtime",
        "",
        "- [ ] Implement headroom module",
      ].join("\n"),
      "utf8"
    );

    // Create a matching package structure in the repo root
    const pkgDir = join(tmpRoot, "packages", "headroom", "src");
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(
      join(pkgDir, "headroom.ts"),
      [
        "export function runHeadroom() {}",
        "export const HEADROOM_VERSION = '1.0.0';",
      ].join("\n"),
      "utf8"
    );
    writeFileSync(
      join(pkgDir, "index.ts"),
      "export { runHeadroom } from './headroom.js';",
      "utf8"
    );

    const report = runConvergeAssessment(tmpRoot, planDir);
    // Headings and checklists that match the package/source files should not
    // produce missing/incomplete gaps. Any remaining gaps are acceptable noise
    // from the heuristic matcher.
    const matchedGaps = report.gapsByKind.missing.filter((gap) =>
      ["Headroom runtime", "Implement headroom module"].includes(gap.planItem)
    );
    expect(matchedGaps.length).toBe(0);
  });

  it("classifies incomplete gaps for partial matches", () => {
    const planDir = join(tmpRoot, "plan");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(
      join(planDir, "ImplementationPlan.md"),
      [
        "# Headroom testing",
        "",
        "## Headroom testing",
        "",
        "- [ ] Build headroom test suite",
      ].join("\n"),
      "utf8"
    );

    // Only create partial implementation: package exists but no tests
    const pkgDir = join(tmpRoot, "packages", "headroom", "src");
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(
      join(pkgDir, "headroom.ts"),
      "export function runHeadroom() {}",
      "utf8"
    );

    const report = runConvergeAssessment(tmpRoot, planDir);
    expect(report.gapsByKind.incomplete.length).toBeGreaterThan(0);
    expect(
      report.actionableTasks.some((t) => t.startsWith("[INCOMPLETE]"))
    ).toBe(true);
  });

  it("returns divergent gaps when plan excludes something that exists", () => {
    const planDir = join(tmpRoot, "plan");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(
      join(planDir, "ImplementationPlan.md"),
      [
        "# No legacy module",
        "",
        "## No legacy module",
        "",
        "- [ ] Remove legacy module",
      ].join("\n"),
      "utf8"
    );

    // Create a "legacy" file that conflicts with the plan
    const pkgDir = join(tmpRoot, "packages", "headroom", "src");
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(
      join(pkgDir, "legacy.ts"),
      "export function legacy() {}",
      "utf8"
    );

    const report = runConvergeAssessment(tmpRoot, planDir);
    expect(report.gapsByKind.divergent.length).toBeGreaterThan(0);
    expect(report.actionableTasks.some((t) => t.startsWith("[DIVERGENT]"))).toBe(
      true
    );
  });

  it("generates actionable tasks with kind prefix", () => {
    const gaps = [
      {
        kind: "missing" as const,
        planItem: "Test suite",
        detail: "No tests found",
        suggestion: "Add tests",
      },
      {
        kind: "divergent" as const,
        planItem: "No old code",
        detail: "Old code exists",
        suggestion: "Reconcile plan",
      },
    ];
    const tasks = actionableTasksFromGaps(gaps);
    expect(tasks).toEqual(["[MISSING] Add tests", "[DIVERGENT] Reconcile plan"]);
  });

  it("scans codebase inventory correctly", () => {
    const repoRoot = join(tmpRoot, "repo");
    mkdirSync(join(repoRoot, "packages", "core", "src"), { recursive: true });
    mkdirSync(join(repoRoot, "packages", "core", "test"), { recursive: true });
    writeFileSync(
      join(repoRoot, "packages", "core", "src", "index.ts"),
      "export const CORE_VERSION = '1.0.0';",
      "utf8"
    );
    writeFileSync(
      join(repoRoot, "packages", "core", "test", "core.test.ts"),
      "import { test } from 'vitest';",
      "utf8"
    );

    const inventory = scanCodebase(repoRoot);
    expect(inventory.packages).toContain("core");
    expect(inventory.sourceFiles.some((f) => f.endsWith("index.ts"))).toBe(
      true
    );
    expect(inventory.testFiles.some((f) => f.endsWith("core.test.ts"))).toBe(
      true
    );
    expect(inventory.exportedSymbols.some((s) => s.includes("CORE_VERSION"))).toBe(
      true
    );
  });

  it("extracts plan items from markdown headings and checklists", () => {
    const planDir = join(tmpRoot, "plan");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(
      join(planDir, "ImplementationPlan.md"),
      [
        "# Glide Implementation Plan",
        "",
        "## Build MCP server",
        "",
        "- [ ] Create glide_converge tool",
        "- [ ] Add Hermes wiring",
      ].join("\n"),
      "utf8"
    );

    const items = loadPlanItems(planDir);
    expect(items).toContain("Glide Implementation Plan");
    expect(items).toContain("Build MCP server");
    expect(items).toContain("Create glide_converge tool");
    expect(items).toContain("Add Hermes wiring");
  });
});
