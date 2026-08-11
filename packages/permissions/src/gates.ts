import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { execSync } from "node:child_process";

export interface GateResult {
  name: string;
  passed: boolean;
  detail: string;
  severity: "error" | "warn" | "info";
}

export interface GateReport {
  workspace: string;
  passed: boolean;
  results: GateResult[];
}

export interface Gate {
  name?: string;
  handler: (ctx: { workspace: string; plan?: string; tasks?: string[] }) => GateResult;
}

export function computeReport(workspace: string, results: GateResult[]): GateReport {
  const passed = results.every((r) => r.passed);
  return { workspace, passed, results };
}

export function runGates(workspace: string, gates: Gate[]): GateReport {
  const results: GateResult[] = [];
  for (const gate of gates) {
    try {
      const result = gate.handler({ workspace });
      results.push(result);
    } catch (error) {
      const gateName = gate.name || "gate";
      results.push({
        name: gateName,
        passed: false,
        detail: error instanceof Error ? error.message : String(error),
        severity: "error",
      });
    }
  }
  return computeReport(workspace, results);
}

function readJsonIfExists(path: string): unknown {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

export const specPlanAlignmentGate: Gate = {
  name: "spec_plan_alignment",
  handler(ctx) {
    const spec = readJsonIfExists(join(ctx.workspace, "specs", "latest.json"));
    const plan = readJsonIfExists(join(ctx.workspace, "plans", "latest.json"));

    if (!spec || !plan) {
      return {
        name: "spec_plan_alignment",
        passed: false,
        detail: "Missing spec or plan artifact",
        severity: "error",
      };
    }

    const specText = JSON.stringify(spec as Record<string, unknown>).toLowerCase();
    const planText = JSON.stringify(plan as Record<string, unknown>).toLowerCase();

    const overlaps = specText.includes("goal") && planText.includes("goal");

    return {
      name: "spec_plan_alignment",
      passed: overlaps,
      detail: overlaps
        ? "Spec and plan share goal overlap"
        : "Spec and plan lack detectable alignment",
      severity: overlaps ? "info" : "warn",
    };
  },
};

export const planTaskCoverageGate: Gate = {
  name: "plan_task_coverage",
  handler(ctx) {
    const plan = readJsonIfExists(join(ctx.workspace, "plans", "latest.json"));

    if (!plan) {
      return {
        name: "plan_task_coverage",
        passed: false,
        detail: "Missing plan artifact",
        severity: "error",
      };
    }

    const planObj = plan as Record<string, unknown>;
    const tasks = Array.isArray(planObj.tasks) ? planObj.tasks : [];

    if (tasks.length === 0) {
      return {
        name: "plan_task_coverage",
        passed: false,
        detail: "Plan has no tasks",
        severity: "error",
      };
    }

    return {
      name: "plan_task_coverage",
      passed: true,
      detail: `Plan contains ${tasks.length} task(s)`,
      severity: "info",
    };
  },
};

export const testPresenceGate: Gate = {
  name: "test_presence",
  handler(ctx) {
    const testDirs = [
      join(ctx.workspace, "test"),
      join(ctx.workspace, "tests"),
    ];

    let hasTests = false;
    let detail = "No test directory found";

    for (const testDir of testDirs) {
      if (existsSync(testDir)) {
        const files = readFileSync(testDir, "utf8");
        if (files.trim().length > 0) {
          hasTests = true;
          detail = `Tests found in ${testDir}`;
          break;
        }
      }
    }

    return {
      name: "test_presence",
      passed: hasTests,
      detail,
      severity: hasTests ? "info" : "warn",
    };
  },
};

export const typecheckGate: Gate = {
  name: "typecheck",
  handler(_ctx) {
    try {
      execSync("tsc --noEmit --pretty false", { stdio: "pipe" });
      return {
        name: "typecheck",
        passed: true,
        detail: "TypeScript typecheck passed",
        severity: "info",
      };
    } catch (error) {
      return {
        name: "typecheck",
        passed: false,
        detail: error instanceof Error ? error.message : String(error),
        severity: "error",
      };
    }
  },
};

export const lintGate: Gate = {
  name: "lint",
  handler(_ctx) {
    try {
      execSync("npm run lint --silent", { stdio: "pipe" });
      return {
        name: "lint",
        passed: true,
        detail: "Lint passed",
        severity: "info",
      };
    } catch (error) {
      return {
        name: "lint",
        passed: false,
        detail: error instanceof Error ? error.message : String(error),
        severity: "error",
      };
    }
  },
};

export const buildGate: Gate = {
  name: "build",
  handler(_ctx) {
    try {
      execSync("npm run build --silent", { stdio: "pipe" });
      return {
        name: "build",
        passed: true,
        detail: "Build passed",
        severity: "info",
      };
    } catch (error) {
      return {
        name: "build",
        passed: false,
        detail: error instanceof Error ? error.message : String(error),
        severity: "error",
      };
    }
  },
};

export const DEFAULT_GATES: Gate[] = [
  specPlanAlignmentGate,
  planTaskCoverageGate,
  testPresenceGate,
  typecheckGate,
  lintGate,
  buildGate,
];
