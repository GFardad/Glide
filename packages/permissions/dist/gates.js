import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { CommandGuardError, runAllowedCommand, sanitizeWorkspacePath } from "@glide/core";
export class GateEngine {
    workspace;
    constructor(workspace) {
        this.workspace = workspace;
    }
    run(gates) {
        const results = [];
        for (const gate of gates) {
            try {
                const result = gate.handler({ workspace: this.workspace });
                results.push(result);
            }
            catch (error) {
                const gateName = gate.name || "gate";
                const detail = error instanceof CommandGuardError ? error.message : error instanceof Error ? error.message : String(error);
                results.push({
                    name: gateName,
                    passed: false,
                    detail,
                    severity: "error",
                });
            }
        }
        return computeReport(this.workspace, results);
    }
}
export function runGates(workspace, gates) {
    const engine = new GateEngine(workspace);
    return engine.run(gates);
}
export function computeReport(workspace, results) {
    const passed = results.every((r) => r.passed);
    return { workspace, passed, results };
}
function runCliCommand(command, cwd) {
    const sanitizedCwd = sanitizeWorkspacePath(cwd, [cwd]);
    return runAllowedCommand(command, sanitizedCwd);
}
function readJsonIfExists(path) {
    if (!existsSync(path)) {
        return { ok: false, reason: "missing", error: `Path not found: ${path}` };
    }
    const stat = statSync(path);
    if (!stat.isFile()) {
        return { ok: false, reason: "not_file", error: `Not a file: ${path}` };
    }
    try {
        const value = JSON.parse(readFileSync(path, "utf8"));
        return { ok: true, value };
    }
    catch (error) {
        return {
            ok: false,
            reason: "parse",
            error: `Failed to parse JSON at ${path}: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}
export const specPlanAlignmentGate = {
    name: "spec_plan_alignment",
    handler(ctx) {
        const specResult = readJsonIfExists(join(ctx.workspace, "specs", "latest.json"));
        const planResult = readJsonIfExists(join(ctx.workspace, "plans", "latest.json"));
        if (!specResult.ok) {
            return {
                name: "spec_plan_alignment",
                passed: false,
                detail: `Missing artifact: ${specResult.error}`,
                severity: "error",
            };
        }
        if (!planResult.ok) {
            return {
                name: "spec_plan_alignment",
                passed: false,
                detail: `Missing artifact: ${planResult.error}`,
                severity: "error",
            };
        }
        const specText = JSON.stringify(specResult.value).toLowerCase();
        const planText = JSON.stringify(planResult.value).toLowerCase();
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
export const planTaskCoverageGate = {
    name: "plan_task_coverage",
    handler(ctx) {
        const planResult = readJsonIfExists(join(ctx.workspace, "plans", "latest.json"));
        if (!planResult.ok) {
            return {
                name: "plan_task_coverage",
                passed: false,
                detail: planResult.error,
                severity: "error",
            };
        }
        const planObj = planResult.value;
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
export const testPresenceGate = {
    name: "test_presence",
    handler(ctx) {
        const testDirs = [
            join(ctx.workspace, "test"),
            join(ctx.workspace, "tests"),
        ];
        let hasTests = false;
        let detail = "No test directory found";
        for (const testDir of testDirs) {
            if (existsSync(testDir) && statSync(testDir).isDirectory()) {
                const entries = readdirSync(testDir, { recursive: false });
                if (entries.some((entry) => typeof entry === "string" && (entry.endsWith(".ts") || entry.endsWith(".js")))) {
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
export const typecheckGate = {
    name: "typecheck",
    handler() {
        try {
            runCliCommand("tsc --noEmit --pretty false", process.cwd());
            return {
                name: "typecheck",
                passed: true,
                detail: "TypeScript typecheck passed",
                severity: "info",
            };
        }
        catch (error) {
            return {
                name: "typecheck",
                passed: false,
                detail: error instanceof Error ? error.message : String(error),
                severity: "error",
            };
        }
    },
};
export const lintGate = {
    name: "lint",
    handler() {
        try {
            runCliCommand("pnpm lint --silent", process.cwd());
            return {
                name: "lint",
                passed: true,
                detail: "Lint passed",
                severity: "info",
            };
        }
        catch (error) {
            return {
                name: "lint",
                passed: false,
                detail: error instanceof Error ? error.message : String(error),
                severity: "error",
            };
        }
    },
};
export const buildGate = {
    name: "build",
    handler() {
        try {
            runCliCommand("pnpm build --silent", process.cwd());
            return {
                name: "build",
                passed: true,
                detail: "Build passed",
                severity: "info",
            };
        }
        catch (error) {
            return {
                name: "build",
                passed: false,
                detail: error instanceof Error ? error.message : String(error),
                severity: "error",
            };
        }
    },
};
export const DEFAULT_GATES = [
    specPlanAlignmentGate,
    planTaskCoverageGate,
    testPresenceGate,
    typecheckGate,
    lintGate,
    buildGate,
];
export class GateLifecycle {
    engine;
    constructor(workspace) {
        this.engine = new GateEngine(workspace);
    }
    run(gates) {
        return this.engine.run(gates ?? DEFAULT_GATES);
    }
}
/**
 * @deprecated Prefer instantiating `new GateLifecycle(workspace)`.
 */
export function createDefaultGateEngine(workspace) {
    return new GateLifecycle(workspace);
}
//# sourceMappingURL=gates.js.map