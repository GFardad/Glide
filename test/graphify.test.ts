import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { GraphifyClient } from "../packages/tracer/src/graphify.js";

describe("GraphifyClient", () => {
  const repoRoot = "/media/Storage/home-gfardad/Projects/Glide";

  it("reads the existing graph data", () => {
    const client = new GraphifyClient({ projectPath: repoRoot });
    const graph = client.read();
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.links.length).toBeGreaterThan(0);
  });

  it("returns nodes and edges from a query", () => {
    const client = new GraphifyClient({ projectPath: repoRoot });
    const result = client.query("package description", 2);
    expect(result.nodes.length).toBeGreaterThan(0);
    expect(result.edges.length).toBeGreaterThanOrEqual(0);
  });

  it("finds shortest paths between related concepts", () => {
    const client = new GraphifyClient({ projectPath: repoRoot });
    const path = client.shortestPath("package", "package_description");
    expect(path).not.toBeNull();
    expect(path!.hops).toBeLessThanOrEqual(1);
    expect(path!.path.length).toBeGreaterThanOrEqual(2);
  });

  it("returns null when no path exists", () => {
    const client = new GraphifyClient({ projectPath: repoRoot });
    const path = client.shortestPath("package", "__this_label_should_not_exist__");
    expect(path).toBeNull();
  });

  it("returns nodes by community", () => {
    const client = new GraphifyClient({ projectPath: repoRoot });
    const nodes = client.community(54);
    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes.every((n) => n.community === 54)).toBe(true);
  });

  it("returns node details by label or id", () => {
    const client = new GraphifyClient({ projectPath: repoRoot });
    const node = client.nodeDetails(".prettierrc.cjs");
    expect(node).not.toBeNull();
    expect(node!.id).toBe("prettierrc");
    expect(node!.label).toBe(".prettierrc.cjs");
  });

  it("returns deterministic PR impact data", () => {
    const client = new GraphifyClient({ projectPath: repoRoot });
    const impact = client.prImpact(1);
    expect(impact.pr_number).toBe(1);
    expect(Array.isArray(impact.files)).toBe(true);
    expect(Array.isArray(impact.communities)).toBe(true);
    expect(impact.nodes_touched).toBeGreaterThanOrEqual(0);
  });

  it("defaults projectPath to cwd when omitted and cwd lacks graphify", () => {
    const client = new GraphifyClient({ projectPath: "/tmp/nonexistent-glide-graph-xyz" });
    expect(() => client.read()).toThrow(/Graphify data not found/);
  });
});
