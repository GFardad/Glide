import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  StdioServerTransport,
} from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { tools } from "./tools/index.js";

const REQUEST_TIMEOUT_MS = 120_000;

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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const result = await tool.handler(
        (request.params.arguments ?? {}) as Record<string, unknown>
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
