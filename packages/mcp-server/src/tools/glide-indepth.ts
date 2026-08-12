import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { GlideTool } from "./types.js";
import { indepthAgent } from "@glide/tracer";
import { createPathGuard } from "@glide/core";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const guardWorkspace = createPathGuard({
  allowedRoots: [process.cwd(), "/tmp"],
  requireExists: true,
});

const guardOutputDir = createPathGuard({
  allowedRoots: [process.cwd(), "/tmp"],
  requireExists: false,
});

export const glideIndepthTool: GlideTool = {
  name: "glide_indepth",
  description: "Dump an agent's full context to a markdown file and return the path",
  inputSchema: {
    type: "object",
    properties: {
      workspace: { type: "string" },
      agent_id: { type: "string" },
      output_dir: { type: "string" },
    },
    required: ["workspace", "agent_id"],
  },
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const workspace = args["workspace"];
    const agentId = args["agent_id"];
    const outputDir = args["output_dir"];
    if (typeof workspace !== "string" || typeof agentId !== "string") {
      throw new Error("workspace and agent_id are required");
    }

    guardWorkspace(workspace);

    const markdown = await indepthAgent({ workspace, agentId });
    const targetDir =
      typeof outputDir === "string" && outputDir.trim().length > 0
        ? guardOutputDir(outputDir).absolute
        : join(workspace, "runtime");
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }
    const outPath = join(targetDir, `${agentId}.md`);
    writeFileSync(outPath, markdown, "utf8");

    return {
      content: [
        { type: "text", text: JSON.stringify({ ok: true, agent_id: agentId, path: outPath }) },
      ],
    };
  },
};
