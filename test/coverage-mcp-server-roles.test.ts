import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { createGlideServer } from "../packages/mcp-server/src/server.js";

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

describe("mcp-server role-gated access", () => {
  it("allows glide_web_search for a CEO caller", async () => {
    const { InMemoryTransport } = await import(mcpSdkPath("inMemory.js"));
    const { Client } = await import(mcpSdkPath("client", "index.js"));

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createGlideServer();
    await server.connect(serverTransport);

    const client = new Client(
      { name: "glide-test", version: "1.0.0" },
      { capabilities: {} }
    );
    await client.connect(clientTransport);

    const result = await client.callTool({
      name: "glide_web_search",
      arguments: { query: "glide", limit: 1, subject_role: "CEO" },
    });
    expect(JSON.parse(result.content[0]?.text ?? "{}")).toMatchObject({ ok: true });

    await client.close();
    await server.close();
  });

  it("blocks glide_dashboard for a viewer role", async () => {
    const { InMemoryTransport } = await import(mcpSdkPath("inMemory.js"));
    const { Client } = await import(mcpSdkPath("client", "index.js"));

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createGlideServer();
    await server.connect(serverTransport);

    const client = new Client(
      { name: "glide-test", version: "1.0.0" },
      { capabilities: {} }
    );
    await client.connect(clientTransport);

    const result = await client.callTool({
      name: "glide_dashboard",
      arguments: { project_path: "/tmp/glide-role-test", subject_role: "viewer" },
    });
    expect(JSON.parse(result.content[0]?.text ?? "{}")).toMatchObject({
      ok: false,
      error: expect.stringContaining("role_not_allowed"),
    });

    await client.close();
    await server.close();
  });
});
