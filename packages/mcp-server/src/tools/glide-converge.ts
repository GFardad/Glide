import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { GlideTool } from "./types.js";
import { createPathGuard } from "@glide/core";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runConvergeAssessment } from "@glide/headroom";

const guardWorkspace = createPathGuard({
  allowedRoots: [process.cwd(), "/tmp"],
  requireExists: true,
});

export const glideConvergeTool: GlideTool = {
  name: "glide_converge",
  description:
    "Assess plan-vs-reality convergence: reads Plan/*.md, scans the codebase " +
    "inventory, classifies gaps as missing/incomplete/divergent, and returns " +
    "actionable remaining tasks",
  inputSchema: {
    type: "object",
    properties: {
      campaign_dir: { type: "string" },
      repo_root: {
        type: "string",
        description:
          "Root of the repository to scan. Defaults to campaign_dir parent when omitted.",
      },
      plan_dir: {
        type: "string",
        description:
          "Directory containing Plan/*.md files. Defaults to <campaign_dir>/plan.",
      },
      write_report: {
        type: "boolean",
        description:
          "When true, write the converge report to <campaign_dir>/artifacts/converge_report.md",
      },
    },
    required: ["campaign_dir"],
  },
  allowedRoles: ["Architect", "QA"],
  requiredScopes: ["converge", "plan"],
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const campaignDir = args["campaign_dir"];
    if (typeof campaignDir !== "string" || !campaignDir.trim()) {
      throw new Error("campaign_dir is required");
    }

    guardWorkspace(campaignDir);

    const repoRoot =
      (args["repo_root"] as string | undefined)?.trim() ||
      join(campaignDir, "..", "..");
    const planDir =
      (args["plan_dir"] as string | undefined)?.trim() ||
      join(campaignDir, "plan");
    const writeReport = (args["write_report"] as boolean | undefined) ?? false;

    guardWorkspace(repoRoot);
    guardWorkspace(planDir);

    const report = runConvergeAssessment(repoRoot, planDir);

    if (writeReport) {
      const artifactsDir = join(campaignDir, "artifacts");
      mkdirSync(artifactsDir, { recursive: true });
      const reportPath = join(artifactsDir, "converge_report.md");
      writeFileSync(reportPath, renderConvergeMarkdown(report));
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              ok: true,
              tool: "glide_converge",
              campaign_dir: campaignDir,
              plan_dir: planDir,
              repo_root: repoRoot,
              report,
              path: reportPath,
            }),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            ok: true,
            tool: "glide_converge",
            campaign_dir: campaignDir,
            plan_dir: planDir,
            repo_root: repoRoot,
            report,
          }),
        },
      ],
    };
  },
};

function renderConvergeMarkdown(report: {
  generatedAt: string;
  planDir: string;
  totalGaps: number;
  gapsByKind: Record<string, { kind: string; planItem: string; detail: string; suggestion: string }[]>;
  actionableTasks: string[];
}): string {
  const lines: string[] = [
    "# Converge Report",
    "",
    `- Generated: ${report.generatedAt}`,
    `- Plan dir: ${report.planDir}`,
    `- Total gaps: ${report.totalGaps}`,
    "",
  ];

  for (const kind of ["missing", "incomplete", "divergent"]) {
    const gaps = report.gapsByKind[kind] ?? [];
    if (gaps.length === 0) continue;
    lines.push(`## ${kind.toUpperCase()} (${gaps.length})`, "");
    for (const gap of gaps) {
      lines.push(`- **${gap.planItem}**`);
      lines.push(`  - Detail: ${gap.detail}`);
      lines.push(`  - Suggestion: ${gap.suggestion}`);
    }
    lines.push("");
  }

  if (report.actionableTasks.length > 0) {
    lines.push("## Actionable Tasks", "");
    for (const task of report.actionableTasks) {
      lines.push(`- ${task}`);
    }
  }

  return lines.join("\n");
}
