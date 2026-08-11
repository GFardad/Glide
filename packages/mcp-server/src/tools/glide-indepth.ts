import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { GlideTool } from "./types.js";
import { indepthAgent } from "@glide/tracer";

export const glideIndepthTool: GlideTool = {
  name: "glide_indepth",
  description:
    "Dump an agent's full context to a markdown file and return the path",
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
    const outputDir =
      (args["output_dir"] as string | undefined) ??
      `${String(workspace)}/runtime/workspace/indepth`;

    if (typeof workspace !== "string" || typeof agentId !== "string") {
      throw new Error("workspace and agent_id are required");
    }

    const md = indepthAgent({ workspace, agentId });
    const path = `${outputDir}/${agentId}.md`;
    const fs = await import("node:fs");
    const pathModule = await import("node:path");
    fs.mkdirSync(pathModule.dirname(path), { recursive: true });
    fs.writeFileSync(path, md, "utf8");

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            ok: true,
            tool: "glide_indepth",
            agent_id: agentId,
            path,
          }),
        },
      ],
    };
  },
};
