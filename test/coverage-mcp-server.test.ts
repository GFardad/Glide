import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { createGlideServer } from "../packages/mcp-server/src/server.js";

/**
 * Coverage tests for packages/mcp-server/src/server.ts.
 * Connects the src server directly to an in-memory transport so the
 * implementation path is marked as hit.
 */

const MCP_SDK_ROOT = join(
  __dirname,
  "..",
  "packages",
  "mcp-server",
  "node_modules",
  "@modelcontextprotocol",
  "sdk"
);

function mcpSdkPath(...segments: string[]): string {
  return join(MCP_SDK_ROOT, "dist", "esm", ...segments);
}

describe("mcp-server src server", () => {
  it("responds to initialize and list tools", async () => {
    const { InMemoryTransport } = await import(mcpSdkPath("inMemory.js"));
    const { Client } = await import(mcpSdkPath("client", "index.js"));

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const server = createGlideServer();
    await server.connect(serverTransport);

    const client = new Client(
      { name: "glide-test", version: "1.0.0" },
      { capabilities: {} }
    );
    await client.connect(clientTransport);

    const init = await client.getServerVersion();
    expect(init.name).toBe("glide");
    expect(init.version).toBe("0.1.0");

    const tools = await client.listTools();
    expect(tools.tools.length).toBeGreaterThan(0);
    expect(tools.tools.some((tool: { name: string }) => tool.name === "glide_status")).toBe(
      true
    );

    const status = await client.callTool({ name: "glide_status", arguments: {} });
    const text = status.content[0];
    expect(text && "text" in text ? JSON.parse(text.text) : null).toMatchObject({
      status: "ok",
    });

    await client.close();
    await server.close();
  });

  it("fails for an unknown tool", async () => {
    const { InMemoryTransport } = await import(mcpSdkPath("inMemory.js"));
    const { Client } = await import(mcpSdkPath("client", "index.js"));

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const server = createGlideServer();
    await server.connect(serverTransport);

    const client = new Client(
      { name: "glide-test", version: "1.0.0" },
      { capabilities: {} }
    );
    await client.connect(clientTransport);

    await expect(
      client.callTool({ name: "glide_does_not_exist", arguments: {} })
    ).rejects.toThrow("MCP error -32603: Unknown tool: glide_does_not_exist");

    await client.close();
    await server.close();
  });
});
