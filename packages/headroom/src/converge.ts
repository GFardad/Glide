import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, basename, extname } from "node:path";

/** Gap classification for plan-vs-codebase assessment. */
export type GapKind = "missing" | "incomplete" | "divergent";

/** Single gap between planned artifact and actual codebase state. */
export interface ConvergeGap {
  kind: GapKind;
  planItem: string;
  actual?: string;
  detail: string;
  suggestion: string;
}

/** Aggregated converge report for a campaign/plan directory. */
export interface ConvergeReport {
  generatedAt: string;
  planDir: string;
  totalGaps: number;
  gapsByKind: Record<GapKind, ConvergeGap[]>;
  actionableTasks: string[];
}

/**
 * Reads Plan/*.md files and extracts high-level plan items.
 * Returns a normalized list of planned components/topics.
 */
export function loadPlanItems(planDir: string): string[] {
  if (!existsSync(planDir)) return [];
  const files = readdirSync(planDir).filter((f) =>
    f.endsWith(".md")
  );
  const items: string[] = [];

  for (const file of files) {
    const content = readFileSync(join(planDir, file), "utf8");
    const lines = content.split("\n");

    // Extract section headers as plan items
    for (const line of lines) {
      const heading = line.match(/^#{1,3}\s+(.+)$/);
      if (heading) {
        const text = heading[1]!.trim();
        if (text.length > 3 && text.length < 120) {
          items.push(text);
        }
      }
    }

    // Extract checklist items as explicit deliverables
    const checklistRe = /^\s*-\s*\[(?: |x)\]\s*(.+)$/;
    for (const line of lines) {
      const match = line.match(checklistRe);
      if (match) {
        const text = match[1]!.trim();
        if (text.length > 3 && text.length < 200) {
          items.push(text);
        }
      }
    }
  }

  // Deduplicate while preserving order
  return Array.from(new Set(items));
}

/**
 * Scans the actual codebase under repoRoot and returns a coarse inventory
 * of implemented components: packages, source files, exported symbols,
 * and test files.
 */
export interface CodebaseInventory {
  packages: string[];
  sourceFiles: string[];
  testFiles: string[];
  exportedSymbols: string[];
}

export function scanCodebase(repoRoot: string): CodebaseInventory {
  const packages: string[] = [];
  const sourceFiles: string[] = [];
  const testFiles: string[] = [];
  const exportedSymbols: string[] = [];

  const packagesDir = join(repoRoot, "packages");
  if (!existsSync(packagesDir)) {
    return { packages, sourceFiles, testFiles, exportedSymbols };
  }

  const packageDirs = readdirSync(packagesDir).filter((f) => {
    const stat = statSync(join(packagesDir, f));
    return stat.isDirectory();
  });

  for (const pkg of packageDirs) {
    packages.push(pkg);
    const pkgRoot = join(packagesDir, pkg);

    // src files and exported symbols
    const srcDir = join(pkgRoot, "src");
    if (existsSync(srcDir)) {
      collectTsFiles(srcDir, sourceFiles);

      const srcFiles: string[] = [];
      collectTsFiles(srcDir, srcFiles);
      for (const srcFile of srcFiles) {
        const content = readFileSync(srcFile, "utf8");
        const exportRe = /export\s+(?:const|function|class|interface|type|enum)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
        let m: RegExpExecArray | null;
        while ((m = exportRe.exec(content)) !== null) {
          exportedSymbols.push(`${pkg}:${m[1]!}`);
        }
      }
    }

    // test files
    const testDir = join(pkgRoot, "test");
    if (existsSync(testDir)) {
      collectTsFiles(testDir, testFiles);
    }
  }

  return { packages, sourceFiles, testFiles, exportedSymbols };
}

function collectTsFiles(dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collectTsFiles(full, out);
    } else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
      out.push(full);
    }
  }
}

/**
 * Compares planned items against the actual codebase inventory and
 * classifies gaps as missing, incomplete, or divergent.
 */
export function assessConvergence(
  planItems: string[],
  inventory: CodebaseInventory
): ConvergeGap[] {
  const gaps: ConvergeGap[] = [];
  const normalizedInventory = new Set([
    ...inventory.packages.map((p) => p.toLowerCase()),
    ...inventory.sourceFiles.map((f) => basename(f).toLowerCase()),
    ...inventory.exportedSymbols.map((s) => s.toLowerCase()),
  ]);

  for (const item of planItems) {
    const lower = item.toLowerCase();

    // Check divergence first for exclusionary plan items
    const negativeRe = /^(?:no|without|remove|delete|drop)\s+(.+)$/i;
    const negMatch = item.match(negativeRe);
    if (negMatch) {
      const forbidden = negMatch[1]!.toLowerCase();
      const forbiddenTokens = forbidden
        .split(/[^a-zA-Z0-9]+/)
        .filter((w) => w.length > 2);
      const hasForbidden = Array.from(normalizedInventory).some((entry) =>
        forbiddenTokens.some((token) => entry.includes(token))
      );
      if (hasForbidden) {
        gaps.push({
          kind: "divergent",
          planItem: item,
          actual: "present in codebase",
          detail: "Plan item excludes a component that exists in the codebase.",
          suggestion: `Reconcile plan with actual structure: ${item}`,
        });
        continue;
      }
    }

    const keywords = lower
      .split(/[^a-zA-Z0-9]+/)
      .filter((w) => w.length > 3);

    // Determine if the plan item is represented in the codebase
    const matchCount = keywords.filter((kw) =>
      Array.from(normalizedInventory).some((entry) => entry.includes(kw))
    ).length;

    if (matchCount === 0) {
      gaps.push({
        kind: "missing",
        planItem: item,
        detail: "No matching implementation found in codebase inventory.",
        suggestion: `Create implementation for: ${item}`,
      });
    } else if (matchCount < keywords.length) {
      gaps.push({
        kind: "incomplete",
        planItem: item,
        detail:
          "Partial match found; implementation appears incomplete or underspecified.",
        suggestion: `Complete implementation for: ${item}`,
      });
    }
  }

  return gaps;
}

/**
 * Generates actionable tasks from the gap list.
 * Each task is a concise instruction suitable for a todo registry.
 */
export function actionableTasksFromGaps(gaps: ConvergeGap[]): string[] {
  const tasks: string[] = [];
  for (const gap of gaps) {
    const prefix =
      gap.kind === "missing"
        ? "[MISSING]"
        : gap.kind === "incomplete"
          ? "[INCOMPLETE]"
          : "[DIVERGENT]";
    tasks.push(`${prefix} ${gap.suggestion}`);
  }
  return tasks;
}

/**
 * Full converge assessment: loads plan items, scans codebase, classifies gaps,
 * and returns a report with actionable tasks.
 */
export function runConvergeAssessment(
  repoRoot: string,
  planDir: string
): ConvergeReport {
  const planItems = loadPlanItems(planDir);
  const inventory = scanCodebase(repoRoot);
  const gaps = assessConvergence(planItems, inventory);
  const actionableTasks = actionableTasksFromGaps(gaps);

  const gapsByKind: Record<GapKind, ConvergeGap[]> = {
    missing: [],
    incomplete: [],
    divergent: [],
  };
  for (const gap of gaps) {
    gapsByKind[gap.kind].push(gap);
  }

  return {
    generatedAt: new Date().toISOString(),
    planDir,
    totalGaps: gaps.length,
    gapsByKind,
    actionableTasks,
  };
}
