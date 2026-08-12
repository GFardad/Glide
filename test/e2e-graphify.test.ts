import { describe, it, expect } from "vitest";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { createGlideServer } from "../packages/mcp-server/src/server.js";
import { Client } from "../packages/mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js";
import { InMemoryTransport } from "../packages/mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/inMemory.js";
import { GraphifyClient } from "../packages/tracer/src/graphify.js";

describe("e2e graphify + mcp surface", () => {
  const repoRoot = "/media/Storage/home-gfardad/Projects/Glide";

  it("GraphifyClient optionality contract: defaults projectPath and throws on missing graph", () => {
    const missingDir = join("/tmp", "glide-graphify-missing-" + Date.now());
    if (existsSync(missingDir)) rmSync(missingDir, { recursive: true });
    mkdirSync(missingDir, { recursive: true });

    const client = new GraphifyClient({ projectPath: missingDir });
    expect(() => client.read()).toThrow(/Graphify data not found/);

    rmSync(missingDir, { recursive: true });
  });

  it("GraphifyClient reads graph data and supports core methods", () => {
    const client = new GraphifyClient({ projectPath: repoRoot });
    const graph = client.read();
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.links.length).toBeGreaterThan(0);

    const query = client.query("package description", 2);
    expect(query.nodes.length).toBeGreaterThan(0);

    const path = client.shortestPath("package", "package_description");
    expect(path).not.toBeNull();
    expect(path!.hops).toBeLessThanOrEqual(1);
    expect(path!.path.length).toBeGreaterThanOrEqual(2);

    const community = client.community(54);
    expect(community.length).toBeGreaterThan(0);
    expect(community.every((n) => n.community === 54)).toBe(true);

    const node = client.nodeDetails(".prettierrc.cjs");
    expect(node).not.toBeNull();
    expect(node!.id).toBe("prettierrc");
    expect(node!.label).toBe(".prettierrc.cjs");

    const impact = client.prImpact(1);
    expect(impact.pr_number).toBe(1);
    expect(Array.isArray(impact.files)).toBe(true);
    expect(Array.isArray(impact.communities)).toBe(true);
    expect(impact.nodes_touched).toBeGreaterThanOrEqual(0);
  });

  it("MCP server lists glide_graph tool and responds to graph actions", async () => {
    const server = createGlideServer();
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const client = new Client(
      { name: "e2e-graphify", version: "1.0.0" },
      { capabilities: {} }
    );
    await client.connect(clientTransport);

    const init = await client.getServerVersion();
    expect(init).toMatchObject({ name: "glide", version: "0.1.0" });

    const listResp = await client.listTools();
    expect(listResp.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "glide_status" }),
        expect.objectContaining({ name: "glide_graph" }),
      ])
    );

    const queryResp = await client.callTool({
      name: "glide_graph",
      arguments: {
        action: "query",
        project_path: repoRoot,
        question: "package description",
        depth: 2,
      },
    });
    expect(queryResp).toMatchObject({
      content: [
        { type: "text", text: expect.stringContaining('"ok":true') },
      ],
    });

    const pathResp = await client.callTool({
      name: "glide_graph",
      arguments: {
        action: "shortest_path",
        project_path: repoRoot,
        source: "package",
        target: "package_description",
        max_hops: 6,
      },
    });
    expect(pathResp).toMatchObject({
      content: [
        { type: "text", text: expect.stringContaining('"ok":true') },
      ],
    });

    const communityResp = await client.callTool({
      name: "glide_graph",
      arguments: {
        action: "community",
        project_path: repoRoot,
        community_id: 54,
      },
    });
    expect(communityResp).toMatchObject({
      content: [
        { type: "text", text: expect.stringContaining('"ok":true') },
      ],
    });

    await client.close();
    await server.close();
  });
});
