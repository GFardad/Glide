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
export declare class GraphifyClient {
    private readonly projectPath;
    private cache;
    constructor(options?: GraphifyClientOptions);
    private resolveGraphPath;
    private loadGraph;
    private isGraphifyData;
    private resetCache;
    /** Read and return the full graph payload. */
    read(): GraphifyData;
    /** BFS/DFS query across the knowledge graph using a natural-language or keyword question. */
    query(question: string, depth?: number): {
        nodes: GraphifyNode[];
        edges: GraphifyLink[];
    };
    /** Find the shortest path between two concepts in the knowledge graph. */
    shortestPath(source: string, target: string, maxHops?: number): {
        path: GraphifyNode[];
        hops: number;
    } | null;
    /** Get all nodes in a specific community. */
    community(communityId: number): GraphifyNode[];
    /** Get full details for a specific node by label or ID. */
    nodeDetails(label: string): GraphifyNode | null;
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
    };
    private resolveNode;
}
//# sourceMappingURL=graphify.d.ts.map