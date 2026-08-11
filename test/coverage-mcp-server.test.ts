import { describe, it, expect } from "vitest";
import { Client } from "../packages/mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js";
import { InMemoryTransport } from "../packages/mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/inMemory.js";
import { createGlideServer } from "../packages/mcp-server/src/server.js";
// Importing the entrypoint barrel executes src/index.ts re-exports.
import * as mcpIndex from "../packages/mcp-server/src/index.js";

/**
 * Coverage gap tests for packages/mcp-server/src/server.ts and index.ts.
 * test/mcp-server.test.ts exercises the compiled dist build over stdio; this
 * test drives the src implementation directly over an in-memory transport.
 */
describe("glide MCP server (src, in-memory)", () => {
  it("exposes createGlideServer and main from the entrypoint", () => {
    expect(typeof mcpIndex.createGlideServer).toBe("function");
    expect(typeof mcpIndex.main).toBe("function");
  });

  it("handles initialize, tools/list, and tools/call", async () => {
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
    const names = tools.tools.map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "glide_status",
        "glide_goal_set",
        "glide_goal_get",
        "glide_headroom",
        "glide_executor",
        "glide_tracer",
        "glide_permissions",
        "glide_indepth",
        "glide_trace",
        "glide_plan",
        "glide_build",
        "glide_test",
        "glide_review",
        "glide_ship",
      ])
    );

    const status = await client.callTool({
      name: "glide_status",
      arguments: {},
    });
    const text = status.content[0];
    expect(text && "text" in text ? JSON.parse(text.text) : null).toMatchObject(
      {
        status: "ok",
        version: "0.1.0",
      }
    );

    await client.close();
    await server.close();
  });

  it("fails with an error for unknown tools", async () => {
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
