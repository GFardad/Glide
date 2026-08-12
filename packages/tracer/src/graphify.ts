import { existsSync, readFileSync, statSync } from "node:fs";
import { join, normalize, relative, sep } from "node:path";

export interface GraphifyNode {
  id: string;
  label: string;
  norm_label: string;
  file_type?: string;
  source_file?: string;
  source_location?: string;
  community?: number | null;
  community_name?: string;
  _origin?: string;
}

export interface GraphifyLink {
  source: string;
  target: string;
  relation: string;
  confidence?: string;
  confidence_score?: number;
  weight?: number;
  source_file?: string;
  source_location?: string;
  _origin?: string;
}

export interface GraphifyData {
  directed?: boolean;
  multigraph?: boolean;
  nodes: GraphifyNode[];
  links: GraphifyLink[];
  hyperedges?: unknown[];
}

export interface GraphifyClientOptions {
  /** Absolute path to repo root containing `graphify-out/graph.json` */
  projectPath?: string;
}

export class GraphifyClient {
  private readonly projectPath: string;
  private cache: GraphifyData | null = null;

  constructor(options: GraphifyClientOptions = {}) {
    this.projectPath = options.projectPath ?? process.cwd();
  }

  private resolveGraphPath(): string {
    const graphDir = join(this.projectPath, "graphify-out");
    const graphPath = join(graphDir, "graph.json");
    const normalizedProject = normalize(this.projectPath);
    const normalizedGraph = normalize(graphPath);
    const relativePath = relative(normalizedProject, normalizedGraph);
    if (relativePath.startsWith("..") || relativePath.startsWith(sep)) {
      throw new Error(`Resolved graph path escapes project path: ${graphPath}`);
    }
    return graphPath;
  }

  private loadGraph(): GraphifyData {
    if (this.cache) return this.cache;
    const path = this.resolveGraphPath();
    if (!existsSync(path)) {
      throw new Error(
        `Graphify data not found at ${path}. Run graphify generation first.`
      );
    }

    const stat = statSync(path);
    if (stat.size > 100 * 1024 * 1024) {
      throw new Error(
        `Graphify data exceeds maximum allowed size: ${stat.size} bytes`
      );
    }

    const raw = readFileSync(path, "utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(
        `Failed to parse Graphify data: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    if (!this.isGraphifyData(parsed)) {
      throw new Error("Graphify data does not match the expected schema");
    }

    this.cache = parsed;
    return this.cache;
  }

  private isGraphifyData(value: unknown): value is GraphifyData {
    if (!value || typeof value !== "object") return false;
    const record = value as Record<string, unknown>;
    return Array.isArray(record.nodes) && Array.isArray(record.links);
  }

  private resetCache(): void {
    this.cache = null;
  }

  /** Read and return the full graph payload. */
  read(): GraphifyData {
    return this.loadGraph();
  }

  /** BFS/DFS query across the knowledge graph using a natural-language or keyword question. */
  query(question: string, depth = 2): { nodes: GraphifyNode[]; edges: GraphifyLink[] } {
    const graph = this.loadGraph();
    const terms = question
      .toLowerCase()
      .split(/[\s\-_/]+/)
      .filter((t) => t.length > 2);

    const scored = graph.nodes.map((node) => {
      const hay = `${node.label} ${node.norm_label} ${node.source_file ?? ""} ${node.community_name ?? ""}`.toLowerCase();
      const score = terms.reduce((acc, term) => (hay.includes(term) ? acc + 1 : acc), 0);
      return { node, score };
    });

    const roots = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((s) => s.node);

    if (roots.length === 0) {
      return { nodes: [], edges: [] };
    }

    const visited = new Set<string>();
    const edges: GraphifyLink[] = [];
    const queue = roots.map((n) => ({ id: n.id, d: 0 }));

    for (const r of roots) visited.add(r.id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.d >= depth) continue;

      for (const link of graph.links) {
        if (link.source === current.id && !visited.has(link.target)) {
          visited.add(link.target);
          edges.push(link);
          queue.push({ id: link.target, d: current.d + 1 });
        } else if (link.target === current.id && !visited.has(link.source)) {
          visited.add(link.source);
          edges.push(link);
          queue.push({ id: link.source, d: current.d + 1 });
        }
      }
    }

    const nodeIds = new Set<string>();
    for (const r of roots) nodeIds.add(r.id);
    for (const e of edges) {
      nodeIds.add(e.source);
      nodeIds.add(e.target);
    }
    const nodes = graph.nodes.filter((n) => nodeIds.has(n.id));

    return { nodes, edges };
  }

  /** Find the shortest path between two concepts in the knowledge graph. */
  shortestPath(source: string, target: string, maxHops = 6): { path: GraphifyNode[]; hops: number } | null {
    const graph = this.loadGraph();
    const sourceNode = this.resolveNode(graph, source);
    const targetNode = this.resolveNode(graph, target);

    if (!sourceNode || !targetNode) return null;

    if (sourceNode.id === targetNode.id) {
      return { path: [sourceNode], hops: 0 };
    }

    const adjacency = buildAdjacency(graph);
    const visited = new Set<string>([sourceNode.id]);
    const queue: { id: string; path: string[] }[] = [{ id: sourceNode.id, path: [sourceNode.id] }];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = adjacency.get(current.id) ?? [];
      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) continue;
        const nextPath = [...current.path, neighbor];
        if (neighbor === targetNode.id) {
          const ids = new Set(nextPath);
          const pathNodes = graph.nodes.filter((n) => ids.has(n.id));
          return { path: pathNodes, hops: nextPath.length - 1 };
        }
        visited.add(neighbor);
        if (nextPath.length <= maxHops) {
          queue.push({ id: neighbor, path: nextPath });
        }
      }
    }

    return null;
  }

  /** Get all nodes in a specific community. */
  community(communityId: number): GraphifyNode[] {
    const graph = this.loadGraph();
    return graph.nodes.filter((n) => n.community === communityId);
  }

  /** Get full details for a specific node by label or ID. */
  nodeDetails(label: string): GraphifyNode | null {
    const graph = this.loadGraph();
    return this.resolveNode(graph, label) ?? null;
  }

  /**
   * Estimate PR impact by mapping a PR number to source files, then returning
   * the communities and nodes those files touch.
   *
   * NOTE: this implementation uses a deterministic mock based on the PR number
   * to avoid hard dependency on git history at runtime. Replace with real
   * file-diff integration when needed.
   */
  prImpact(prNumber: number): {
    pr_number: number;
    files: string[];
    communities: number[];
    community_names: string[];
    nodes_touched: number;
  } {
    const graph = this.loadGraph();
    const files = pickFilesForPr(prNumber, graph.nodes);
    const communityIds = new Set<number>();
    const communityNames = new Set<string>();
    const nodeIds = new Set<string>();

    for (const file of files) {
      for (const node of graph.nodes) {
        if (node.source_file === file || node.label === file) {
          nodeIds.add(node.id);
          if (typeof node.community === "number") {
            communityIds.add(node.community);
            if (node.community_name) communityNames.add(node.community_name);
          }
        }
      }
    }

    return {
      pr_number: prNumber,
      files,
      communities: Array.from(communityIds).sort((a, b) => a - b),
      community_names: Array.from(communityNames).sort(),
      nodes_touched: nodeIds.size,
    };
  }

  private resolveNode(graph: GraphifyData, term: string): GraphifyNode | null {
    const lowered = term.toLowerCase().trim();
    const exact = graph.nodes.find(
      (n) => n.id.toLowerCase() === lowered || n.label.toLowerCase() === lowered
    );
    if (exact) return exact;

    const partial = graph.nodes.find((n) =>
      [n.id, n.label, n.norm_label, n.source_file, n.community_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(lowered))
    );
    return partial ?? null;
  }
}

function buildAdjacency(graph: GraphifyData): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const link of graph.links) {
    const list = map.get(link.source) ?? [];
    if (!list.includes(link.target)) list.push(link.target);
    map.set(link.source, list);

    if (!graph.directed) {
      const back = map.get(link.target) ?? [];
      if (!back.includes(link.source)) back.push(link.source);
      map.set(link.target, back);
    }
  }
  return map;
}

/**
 * Deterministic PR → file mapping.
 * For a real integration, replace with `git diff --name-only $BASE..$HEAD`
 * filtered by the knowledge-graph nodes.
 */
function pickFilesForPr(prNumber: number, nodes: GraphifyNode[]): string[] {
  const sourceFiles = Array.from(
    new Set(nodes.map((n) => n.source_file).filter((v): v is string => Boolean(v)))
  );
  if (sourceFiles.length === 0) return [];

  const seed = prNumber % sourceFiles.length;
  const count = Math.min(3, sourceFiles.length);
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(sourceFiles[(seed + i) % sourceFiles.length] as string);
  }
  return result;
}
