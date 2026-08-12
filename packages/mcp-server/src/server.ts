import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  StdioServerTransport,
} from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { tools } from "./tools/index.js";
import type { GlideTool } from "./tools/types.js";

const REQUEST_TIMEOUT_MS = 120_000;

function parseToolArguments(tool: GlideTool, args: Record<string, unknown>): Record<string, unknown> {
  if (tool.inputSchema && tool.inputSchema.properties) {
    const parsed: Record<string, unknown> = {};
    const properties = tool.inputSchema.properties;
    const required = new Set(tool.inputSchema.required ?? []);
    for (const [key, schema] of Object.entries(properties)) {
      const value = args[key];
      if (value === undefined || value === null) {
        if (required.has(key)) {
          throw new Error(`Missing required argument: ${key}`);
        }
        continue;
      }
      const expectedType = (schema as { type?: string }).type;
      if (expectedType === "string" && typeof value !== "string") {
        throw new Error(`Invalid argument: ${key} must be a string`);
      }
      if (expectedType === "array" && !Array.isArray(value)) {
        throw new Error(`Invalid argument: ${key} must be an array`);
      }
      if (expectedType === "number" && typeof value !== "number") {
        throw new Error(`Invalid argument: ${key} must be a number`);
      }
      if (expectedType === "boolean" && typeof value !== "boolean") {
        throw new Error(`Invalid argument: ${key} must be a boolean`);
      }
      parsed[key] = value;
    }
    return parsed;
  }
  return args;
}

export function createGlideServer(): Server {
  const server = new Server(
    { name: "glide", version: "0.1.0" },
    { capabilities: { tools: { listChanged: false } } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find((t) => t.name === request.params.name);
    if (!tool) {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }
    const arguments_ = request.params.arguments ?? {};
    const parsed = parseToolArguments(tool, arguments_ as Record<string, unknown>);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const result = await tool.handler(
        parsed
      );
      return result;
    } finally {
      clearTimeout(timeoutId);
    }
  });

  return server;
}

export async function main(): Promise<void> {
  const server = createGlideServer();
  const transport = new StdioServerTransport();

  server.oninitialized = () => {
    // SDK handles sending the initialized notification to the client
  };

  await server.connect(transport);

  process.on("SIGINT", () => {
    void server.close().then(() => process.exit(0));
  });

  process.on("SIGTERM", () => {
    void server.close().then(() => process.exit(0));
  });
}
