import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { runRoleAnalysis } from "./roles.js";
import { HeadroomRuntime } from "./runtime.js";
/** Raised when headroom input is invalid (e.g. missing objective). */
export class HeadroomInputError extends Error {
    constructor(message) {
        super(message);
        this.name = "HeadroomInputError";
    }
}
/** Raised when writing a headroom artifact to disk fails. Carries the target path. */
export class HeadroomIOError extends Error {
    path;
    constructor(message, path) {
        super(message);
        this.name = "HeadroomIOError";
        this.path = path;
    }
}
/** Write an artifact, surfacing the target path on failure for debuggability. */
function writeArtifact(campaignDir, fileName, content) {
    const path = join(campaignDir, "artifacts", fileName);
    try {
        mkdirSync(join(campaignDir, "artifacts"), { recursive: true });
        writeFileSync(path, content, "utf8");
    }
    catch (error) {
        throw new HeadroomIOError(`Failed to write artifact ${fileName} (${path}): ${error instanceof Error ? error.message : String(error)}`, path);
    }
}
const DEFAULT_ROLES = ["Architect", "Engineer", "Security", "QA", "Product"];
export async function runHeadroom(input) {
    const { campaignDir, objective, roles } = input;
    if (typeof objective !== "string" || objective.trim().length === 0) {
        throw new HeadroomInputError("Objective must be a non-empty string");
    }
    const selectedRoles = roles.length > 0 ? roles : DEFAULT_ROLES;
    const runtime = new HeadroomRuntime({ root: campaignDir });
    runtime.start();
    const state = await runtime.init(objective);
    const roleAnalysis = await runRoleAnalysis(objective, selectedRoles, campaignDir);
    const riskLog = generateRiskLog(roleAnalysis);
    const architecture = generateArchitecture(roleAnalysis);
    const todoRegistry = generateTodoRegistry(roleAnalysis);
    const driftDetected = detectDrift(objective, [
        riskLog,
        architecture,
        todoRegistry,
    ]);
    const delta = {
        timestamp: new Date().toISOString(),
        evidence: objective,
        operations: [
            {
                kind: "update",
                goalId: state.campaign.id,
                goal: objective,
                previousGoal: state.campaign.goal,
                metadata: { source: "headroom" },
            },
        ],
    };
    runtime.applyDelta(delta);
    writeArtifact(campaignDir, "risk_log.md", riskLog);
    writeArtifact(campaignDir, "architecture.md", architecture);
    writeArtifact(campaignDir, "todo_registry.md", todoRegistry);
    writeArtifact(campaignDir, "role_analysis.json", JSON.stringify(roleAnalysis, null, 2));
    return {
        campaign: {
            id: state.campaign.id,
            root: state.campaign.root,
            goal: objective,
            nonGoals: state.campaign.nonGoals,
            assumptions: state.campaign.assumptions,
            createdAt: new Date(state.campaign.createdAt),
            updatedAt: new Date(state.campaign.updatedAt),
        },
        riskLog,
        architecture,
        todoRegistry,
        driftDetected,
        roleSignals: Object.fromEntries(selectedRoles.map((role) => [role, roleAnalysis[role]?.signals ?? []])),
        appliedDelta: delta,
    };
}
function generateRiskLog(roleAnalysis) {
    const lines = ["# Risk Log", "", "## Role Assessments", ""];
    for (const [role, data] of Object.entries(roleAnalysis)) {
        lines.push(`- ${role}: ${data.assessment}`);
    }
    lines.push("");
    lines.push("## Aggregated Risks", "");
    const allRisks = new Map();
    for (const data of Object.values(roleAnalysis)) {
        for (const risk of data.risks) {
            allRisks.set(risk, (allRisks.get(risk) ?? 0) + 1);
        }
    }
    const sorted = Array.from(allRisks.entries()).sort((a, b) => b[1] - a[1]);
    for (const [risk, count] of sorted) {
        lines.push(`- ${risk} (${count} role${count === 1 ? "" : "s"})`);
    }
    return lines.join("\n");
}
function generateArchitecture(roleAnalysis) {
    const lines = ["# Architecture", "", "## Components", ""];
    lines.push("- Campaign Store");
    lines.push("- Headroom Runtime");
    lines.push("- Execution Teams");
    lines.push("- Permission Layer");
    lines.push("");
    lines.push("## Role-identified improvements", "");
    for (const [role, data] of Object.entries(roleAnalysis)) {
        if (data.improvements.length > 0) {
            lines.push(`### ${role}`);
            for (const improvement of data.improvements) {
                lines.push(`- ${improvement}`);
            }
        }
    }
    return lines.join("\n");
}
function generateTodoRegistry(roleAnalysis) {
    const lines = ["# Todo Registry", "", "## Epic", ""];
    lines.push("- Deliver Headroom artifacts for selected roles", "");
    lines.push("## Tasks", "");
    for (const [role, data] of Object.entries(roleAnalysis)) {
        for (const todo of data.todos) {
            lines.push(`- [ ] ${role}: ${todo}`);
        }
    }
    return lines.join("\n");
}
function detectDrift(objective, artifacts) {
    const normalized = objective.trim().toLowerCase();
    if (normalized.length === 0)
        return true;
    const combined = artifacts.join("\n").toLowerCase();
    return !combined.includes(normalized);
}
//# sourceMappingURL=headroom.js.map