import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { GlideTool } from "./types.js";
import { runGates, DEFAULT_GATES } from "@glide/permissions";

export const glideGatesTool: GlideTool = {
  name: "glide_gates",
  description:
    "Run cross-artifact consistency gates across specs, plans, tasks, tests, typecheck, lint, and build. " +
    "Use before glide_indepth or implementation phases.",
  inputSchema: {
    type: "object",
    properties: {
      workspace: { type: "string" },
      gates: {
        type: "array",
        items: { type: "string" },
        description:
          "Optional gate names to run. Defaults to all supported gates.",
      },
    },
    required: ["workspace"],
  },
  allowedRoles: ["QA", "Security"],
  requiredScopes: ["gates", "verify"],
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const workspace = args["workspace"];
    if (typeof workspace !== "string" || !workspace.trim()) {
      throw new Error("workspace is required");
    }

    const requested = (args["gates"] as string[] | undefined) ?? [];
    const allGates = DEFAULT_GATES.filter((gate) =>
      requested.length === 0 ? true : requested.includes(gate.name!)
    );

    const report = runGates(workspace, allGates);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            tool: "glide_gates",
            workspace,
            passed: report.passed,
            results: report.results,
          }),
        },
      ],
    };
  },
};
