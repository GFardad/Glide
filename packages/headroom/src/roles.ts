import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const BLOCKING = [
  "backdoor",
  "bypass",
  "disable security",
  "disable auth",
  "disable verification",
  "rootkit",
  "obfuscate",
  "stealth",
  "exfiltrate",
];

function isBlocking(objective: string): boolean {
  const normalized = objective.toLowerCase();
  return BLOCKING.some((token) => normalized.includes(token));
}

function keywordSignals(objective: string, role: string): string[] {
  if (isBlocking(objective)) {
    return [];
  }
  const normalized = objective.toLowerCase();
  const tokens = normalized.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const unique = Array.from(new Set(tokens));
  const roleSignals: Record<string, string[]> = {
    Architect: [
      "architecture",
      "interface",
      "module",
      "boundary",
      "contract",
      "compatibility",
    ],
    Engineer: [
      "runtime",
      "worker",
      "backend",
      "process",
      "harness",
      "retry",
      "build",
      "deploy",
      "execution",
    ],
    Security: [
      "auth",
      "permission",
      "trust",
      "input",
      "validation",
      "audit",
      "secret",
      "token",
    ],
    QA: [
      "test",
      "coverage",
      "regression",
      "acceptance",
      "e2e",
      "verification",
      "monitor",
    ],
    Product: [
      "goal",
      "scope",
      "roadmap",
      "risk",
      "user",
      "value",
      "deliverable",
    ],
  };
  const hintTerms = roleSignals[role] ?? [];
  return unique.filter((token) =>
    hintTerms.some((hint) => token.includes(hint) || hint.includes(token))
  );
}

function buildAssessment(role: string, objective: string): string {
  if (isBlocking(objective)) {
    return `Blocked: objective conflicts with ${role} safeguards.`;
  }
  const signals = keywordSignals(objective, role);
  if (signals.length === 0) {
    return `Accepted with notes: no direct ${role} signals in objective.`;
  }
  return `Accepted: ${role} signals found.`;
}

function buildRisks(role: string, objective: string): string[] {
  if (isBlocking(objective)) {
    return ["malicious objective", "policy violation", "requires human review"];
  }
  const risks = [
    "context loss across boundaries",
    "model hallucination in mid-tier outputs",
  ];
  if (role === "Security")
    risks.push("untrusted input surface", "auth/permission drift");
  if (role === "QA")
    risks.push("missing regression coverage", "undefined acceptance criteria");
  if (role === "Engineer")
    risks.push("retry/backoff gaps", "process lifecycle leakage");
  if (role === "Architect")
    risks.push("interface contract drift", "circular package dependency");
  if (role === "Product")
    risks.push("scope creep", "missing user value justification");
  return risks;
}

function buildImprovements(role: string, objective: string): string[] {
  const improvements: Record<string, string[]> = {
    Architect: [
      "Define interface contracts for runtime modules.",
      "Validate backward compatibility for campaign store.",
    ],
    Engineer: [
      "Add retry budget around execution backend.",
      "Instrument worker heartbeats and shutdown paths.",
    ],
    Security: [
      "Validate MCP input schema before tool dispatch.",
      "Mask sensitive payload keys in logs.",
    ],
    QA: [
      "Add e2e verification for MCP stdio surface.",
      "Expand regression tests for meeting room roles.",
    ],
    Product: [
      "Write acceptance criteria for Headroom outputs.",
      "Map user tasks to MCP tool surface.",
    ],
  };
  const selected = improvements[role] ?? [
    "Review objective alignment",
    "Add acceptance criteria",
  ];
  if (isBlocking(objective)) {
    return ["Reject or revise objective before proceeding."];
  }
  return selected;
}

function buildTodos(role: string, objective: string): string[] {
  if (isBlocking(objective)) {
    return ["Escalate to human review", "Document rejection reason"];
  }
  const todos: Record<string, string[]> = {
    Architect: ["Finalize package boundary map", "Review dependency graph"],
    Engineer: [
      "Wire retry/backoff in execution backend",
      "Add process lifecycle tests",
    ],
    Security: [
      "Add schema validation for all MCP tools",
      "Implement payload masking",
    ],
    QA: [
      "Add regression tests for drift detection",
      "Add MCP stdio smoke test",
    ],
    Product: ["Draft acceptance criteria", "Validate tool naming convention"],
  };
  return todos[role] ?? ["Review objective", "Add task breakdown"];
}

export interface RoleAnalysis {
  [role: string]: {
    assessment: string;
    signals: string[];
    risks: string[];
    improvements: string[];
    todos: string[];
  };
}

export async function runRoleAnalysis(
  objective: string,
  roles: string[],
  campaignDir: string
): Promise<RoleAnalysis> {
  const analysis: RoleAnalysis = {};
  for (const role of roles) {
    analysis[role] = {
      assessment: buildAssessment(role, objective),
      signals: keywordSignals(objective, role),
      risks: buildRisks(role, objective),
      improvements: buildImprovements(role, objective),
      todos: buildTodos(role, objective),
    };
  }

  const artifactPath = join(campaignDir, "artifacts", "role_analysis.json");
  mkdirSync(join(campaignDir, "artifacts"), { recursive: true });
  writeFileSync(artifactPath, JSON.stringify(analysis, null, 2));

  return analysis;
}
