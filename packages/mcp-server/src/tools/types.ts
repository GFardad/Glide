import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export type GlideToolHandler = (
  args: Record<string, unknown>
) => Promise<CallToolResult> | CallToolResult;

export interface GlideTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
  };
  handler: GlideToolHandler;
}
