import { describe, it, expect, beforeEach } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { glideGraphTool } from "../packages/mcp-server/src/tools/glide-graph.js";
import { glideStatusTool } from "../packages/mcp-server/src/tools/glide-status.js";
import { glideTraceTool } from "../packages/mcp-server/src/tools/glide-trace.js";

function textOf(result: {
  content: Array<{ type: string; text?: string }>;
}): string {
  const item = result.content[0];
  return item && typeof item.text === "string" ? item.text : "";
}

function writeMinimalGraphify(projectPath: string) {
  const dir = join(projectPath, "graphify-out");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "graph.json"),
    JSON.stringify({
      directed: false,
      multigraph: false,
      nodes: [
        {
          id: "pkg",
          label: "package.json",
          norm_label: "package.json",
          community: 0,
          community_name: "root",
          source_file: "package.json",
          file_type: "code",
          source_location: "L1",
        },
        {
          id: "ver",
          label: "version",
          norm_label: "version",
          community: 0,
          community_name: "root",
          source_file: "package.json",
          file_type: "code",
          source_location: "L2",
        },
      ],
      links: [
        {
          source: "pkg",
          target: "ver",
          relation: "contains",
          confidence: "high",
          confidence_score: 0.99,
        },
      ],
    }),
    "utf8"
  );
}

describe("glide_graph MCP tool", () => {
  const tmpRoot = "/tmp/glide-graph-mcp-test";

  beforeEach(() => {
    if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true });
    mkdirSync(tmpRoot, { recursive: true });
    writeMinimalGraphify(tmpRoot);
  });

  it("returns graph_stats when graph.json is present", async () => {
    const result = await glideGraphTool.handler({
      action: "graph_stats",
      project_path: tmpRoot,
    });
    const parsed = JSON.parse(textOf(result));
    expect(parsed.ok).toBe(true);
    expect(parsed.action).toBe("graph_stats");
    expect(parsed.node_count).toBe(2);
    expect(parsed.edge_count).toBe(1);
    expect(parsed.communities).toEqual([0]);
  });

  it("returns graph_stats error when graph.json is missing", async () => {
    const missing = join(tmpRoot, "missing");
    const result = await glideGraphTool.handler({
      action: "graph_stats",
      project_path: missing,
    });
    const parsed = JSON.parse(textOf(result));
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toContain("Graphify data not found");
  });

  it("queries the graph with BFS/DFS", async () => {
    const result = await glideGraphTool.handler({
      action: "query",
      project_path: tmpRoot,
      question: "package",
      depth: 1,
    });
    const parsed = JSON.parse(textOf(result));
    expect(parsed.ok).toBe(true);
    expect(parsed.nodes.length).toBeGreaterThan(0);
    expect(parsed.edges.length).toBeGreaterThanOrEqual(0);
  });

  it("finds shortest path between concepts", async () => {
    const result = await glideGraphTool.handler({
      action: "shortest_path",
      project_path: tmpRoot,
      source: "package.json",
      target: "version",
    });
    const parsed = JSON.parse(textOf(result));
    expect(parsed.ok).toBe(true);
    expect(parsed.path).not.toBeNull();
    expect(parsed.path.length).toBeGreaterThanOrEqual(2);
  });

  it("returns null when no shortest path exists", async () => {
    const result = await glideGraphTool.handler({
      action: "shortest_path",
      project_path: tmpRoot,
      source: "package.json",
      target: "__none__",
    });
    const parsed = JSON.parse(textOf(result));
    expect(parsed.ok).toBe(true);
    expect(parsed.path).toBeNull();
  });

  it("returns nodes by community", async () => {
    const result = await glideGraphTool.handler({
      action: "community",
      project_path: tmpRoot,
      community_id: 0,
    });
    const parsed = JSON.parse(textOf(result));
    expect(parsed.ok).toBe(true);
    expect(parsed.count).toBe(2);
    expect(parsed.nodes.every((n: { community_name?: string }) => n.community_name === "root")).toBe(true);
  });

  it("returns node details by label", async () => {
    const result = await glideGraphTool.handler({
      action: "node_details",
      project_path: tmpRoot,
      label: "package.json",
    });
    const parsed = JSON.parse(textOf(result));
    expect(parsed.ok).toBe(true);
    expect(parsed.node).not.toBeNull();
    expect(parsed.node.id).toBe("pkg");
    expect(parsed.node.source_file).toBe("package.json");
  });

  it("returns null for missing node details", async () => {
    const result = await glideGraphTool.handler({
      action: "node_details",
      project_path: tmpRoot,
      label: "__none__",
    });
    const parsed = JSON.parse(textOf(result));
    expect(parsed.ok).toBe(true);
    expect(parsed.node).toBeNull();
  });

  it("returns deterministic PR impact data", async () => {
    const result = await glideGraphTool.handler({
      action: "pr_impact",
      project_path: tmpRoot,
      pr_number: 1,
    });
    const parsed = JSON.parse(textOf(result));
    expect(parsed.ok).toBe(true);
    expect(parsed.pr_number).toBe(1);
    expect(Array.isArray(parsed.files)).toBe(true);
    expect(Array.isArray(parsed.communities)).toBe(true);
    expect(typeof parsed.nodes_touched).toBe("number");
  });

  it("rejects unsupported action", async () => {
    const result = await glideGraphTool.handler({
      action: "bogus",
      project_path: tmpRoot,
    });
    const parsed = JSON.parse(textOf(result));
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toContain("Unsupported graph action");
  });
});

describe("glide_status with graphify", () => {
  const tmpRoot = "/tmp/glide-status-graphify-test";

  beforeEach(() => {
    if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true });
    mkdirSync(tmpRoot, { recursive: true });
  });

  it("returns base status without project_path", async () => {
    const result = await glideStatusTool.handler({});
    const parsed = JSON.parse(textOf(result));
    expect(parsed.status).toBe("ok");
    expect(parsed.version).toBe("0.1.0");
    expect(parsed.graphify).toBeUndefined();
  });

  it("appends graphify summary when project_path is provided and graph exists", async () => {
    writeMinimalGraphify(tmpRoot);
    const result = await glideStatusTool.handler({ project_path: tmpRoot });
    const parsed = JSON.parse(textOf(result));
    expect(parsed.status).toBe("ok");
    expect(parsed.graphify.node_count).toBe(2);
    expect(parsed.graphify.edge_count).toBe(1);
    expect(parsed.graphify.communities).toEqual([0]);
  });

  it("reports graphify unavailable when graph.json is missing", async () => {
    const result = await glideStatusTool.handler({ project_path: tmpRoot });
    const parsed = JSON.parse(textOf(result));
    expect(parsed.status).toBe("ok");
    expect(parsed.graphify.available).toBe(false);
    expect(parsed.graphify.error).toContain("Graphify data not found");
  });
});

describe("glide_trace with graphify neighbors", () => {
  const tmpRoot = "/tmp/glide-trace-graphify-test";

  beforeEach(() => {
    if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true });
    mkdirSync(tmpRoot, { recursive: true });
    const agents = join(tmpRoot, "agents", "agent-1");
    mkdirSync(agents, { recursive: true });
    writeFileSync(join(agents, "GOAL.md"), "# Goal\n\nGoal of agent-1\n");
    writeFileSync(join(agents, "PERSONALITY.md"), "# Personality\n\nParent: none\n");
    writeFileSync(join(agents, "NOTES.md"), "- note\n");
    writeFileSync(join(agents, "TODO.md"), "- todo\n");
  });

  it("returns trace without graphify when graph.json is missing", async () => {
    const result = await glideTraceTool.handler({
      workspace: tmpRoot,
      agent_id: "agent-1",
    });
    const parsed = JSON.parse(textOf(result));
    expect(parsed.ok).toBe(true);
    expect(parsed.agent_id).toBe("agent-1");
    expect(parsed.trace.chain).toEqual([]);
    expect(parsed.graphify).toBeUndefined();
  });

  it("enriches trace with graphify neighbors when available", async () => {
    writeMinimalGraphify(tmpRoot);
    const result = await glideTraceTool.handler({
      workspace: tmpRoot,
      agent_id: "agent-1",
    });
    const parsed = JSON.parse(textOf(result));
    expect(parsed.ok).toBe(true);
    expect(parsed.agent_id).toBe("agent-1");
    expect(parsed.trace.chain).toEqual([]);
    expect(parsed.graphify).toBeUndefined();
  });
});
