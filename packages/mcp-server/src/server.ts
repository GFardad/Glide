import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { tools } from "./tools/index.js";

export function createGlideServer(): Server {
  const server = new Server(
    { name: "glide", version: "0.1.0" },
    { capabilities: { tools: {} } }
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
    return tool.handler(
      (request.params.arguments ?? {}) as Record<string, unknown>
    );
  });

  return server;
}

export async function main() {
  const server = createGlideServer();
  const stdin = process.stdin;
  const stdout = process.stdout;

  stdin.setEncoding("utf8");
  let buffer = "";

  stdin.on("data", (chunk: string) => {
    buffer += chunk;
    let boundary;
    while ((boundary = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, boundary).trim();
      buffer = buffer.slice(boundary + 1);
      if (line.length === 0) {
        continue;
      }
      void (async () => {
        try {
          // Simple stdio JSON-RPC bridge for tool calls
          const envelope = JSON.parse(line);
          if (
            envelope.jsonrpc === "2.0" &&
            typeof envelope.id !== "undefined" &&
            envelope.method === "tools/call"
          ) {
            const tool = tools.find(
              (t) => t.name === envelope.params?.name
            );
            if (!tool) {
              stdout.write(
                JSON.stringify({
                  jsonrpc: "2.0",
                  id: envelope.id,
                  error: { code: -32601, message: `Unknown tool: ${envelope.params?.name}` },
                }) + "\n"
              );
              return;
            }
            const result = await tool.handler(
              (envelope.params?.arguments ?? {}) as Record<string, unknown>
            );
            stdout.write(
              JSON.stringify({
                jsonrpc: "2.0",
                id: envelope.id,
                result,
              }) + "\n"
            );
            return;
          }

          if (envelope.jsonrpc === "2.0" && envelope.method === "initialize") {
            stdout.write(
              JSON.stringify({
                jsonrpc: "2.0",
                id: envelope.id,
                result: {
                  protocolVersion: "2024-11-05",
                  capabilities: { tools: { listChanged: false } },
                  serverInfo: { name: "glide", version: "0.1.0" },
                },
              }) + "\n"
            );
            return;
          }

          if (envelope.jsonrpc === "2.0" && envelope.method === "tools/list") {
            stdout.write(
              JSON.stringify({
                jsonrpc: "2.0",
                id: envelope.id,
                result: {
                  tools: tools.map((tool) => ({
                    name: tool.name,
                    description: tool.description,
                    inputSchema: tool.inputSchema,
                  })),
                },
              }) + "\n"
            );
            return;
          }

          stdout.write(
            JSON.stringify({
              jsonrpc: "2.0",
              id: envelope.id,
              error: { code: -32601, message: "Method not found" },
            }) + "\n"
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          stdout.write(
            JSON.stringify({
              jsonrpc: "2.0",
              id: null,
              error: { code: -32603, message },
            }) + "\n"
          );
        }
      })();
    }
  });

  stdin.on("end", async () => {
    const remaining = buffer.trim();
    if (remaining.length > 0) {
      // Process remaining line synchronously to avoid unhandled rejections
      try {
        const envelope = JSON.parse(remaining);
        if (
          envelope.jsonrpc === "2.0" &&
          typeof envelope.id !== "undefined" &&
          envelope.method === "tools/call"
        ) {
          const tool = tools.find((t) => t.name === envelope.params?.name);
          if (!tool) {
            stdout.write(
              JSON.stringify({
                jsonrpc: "2.0",
                id: envelope.id,
                error: { code: -32601, message: `Unknown tool: ${envelope.params?.name}` },
              }) + "\n"
            );
            return;
          }
          const result = await tool.handler(
            (envelope.params?.arguments ?? {}) as Record<string, unknown>
          );
          stdout.write(
            JSON.stringify({
              jsonrpc: "2.0",
              id: envelope.id,
              result,
            }) + "\n"
          );
        }
      } catch {
        // ignore
      }
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
