import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { runRoleAnalysis } from "./roles.js";
import { HeadroomRuntime } from "./runtime.js";
import type { HeadroomDelta } from "./delta.js";

export interface HeadroomInput {
  campaignDir: string;
  objective: string;
  roles: string[];
}

export interface HeadroomResult {
  campaign: {
    id: string;
    root: string;
    goal: string;
    nonGoals: string[];
    assumptions: string[];
    createdAt: Date;
    updatedAt: Date;
  };
  riskLog: string;
  architecture: string;
  todoRegistry: string;
  driftDetected: boolean;
  roleSignals: Record<string, string[]>;
  appliedDelta: HeadroomDelta | null;
}

const DEFAULT_ROLES = ["Architect", "Engineer", "Security", "QA", "Product"];

export async function runHeadroom(
  input: HeadroomInput
): Promise<HeadroomResult> {
  const { campaignDir, objective, roles } = input;
  const selectedRoles = roles.length > 0 ? roles : DEFAULT_ROLES;

  const runtime = new HeadroomRuntime(campaignDir);
  const state = await runtime.initialize(objective);

  const roleAnalysis = await runRoleAnalysis(objective, selectedRoles, campaignDir);
  const riskLog = generateRiskLog(roleAnalysis);
  const architecture = generateArchitecture(roleAnalysis);
  const todoRegistry = generateTodoRegistry(roleAnalysis);
  const driftDetected = detectDrift(objective, [
    riskLog,
    architecture,
    todoRegistry,
  ]);

  const delta: HeadroomDelta = {
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

  writeFileSync(join(campaignDir, "artifacts", "risk_log.md"), riskLog);
  writeFileSync(join(campaignDir, "artifacts", "architecture.md"), architecture);
  writeFileSync(join(campaignDir, "artifacts", "todo_registry.md"), todoRegistry);
  writeFileSync(
    join(campaignDir, "artifacts", "role_analysis.json"),
    JSON.stringify(roleAnalysis, null, 2)
  );

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
    roleSignals: Object.fromEntries(
      selectedRoles.map((role) => [role, roleAnalysis[role]?.signals ?? []])
    ),
    appliedDelta: delta,
  };
}

function generateRiskLog(
  roleAnalysis: Record<string, { assessment: string; risks: string[] }>
): string {
  const lines = ["# Risk Log", "", "## Role Assessments", ""];
  for (const [role, data] of Object.entries(roleAnalysis)) {
    lines.push(`- ${role}: ${data.assessment}`);
  }
  lines.push("");
  lines.push("## Aggregated Risks", "");
  const allRisks = new Map<string, number>();
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

function generateArchitecture(
  roleAnalysis: Record<string, { improvements: string[] }>
): string {
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

function generateTodoRegistry(
  roleAnalysis: Record<string, { todos: string[] }>
): string {
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

function detectDrift(objective: string, artifacts: string[]): boolean {
  const normalized = objective.trim().toLowerCase();
  if (normalized.length === 0) return true;
  const combined = artifacts.join("\n").toLowerCase();
  return !combined.includes(normalized);
}
