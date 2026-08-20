import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { GlideTool } from "./types.js";
import { GraphifyClient } from "@glide/tracer";

export const glideGraphTool: GlideTool = {
  name: "glide_graph",
  description:
    "Query the Glide project knowledge graph (graphify) for relationships, shortest paths, communities, and PR impact.",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: [
          "graph_stats",
          "query",
          "shortest_path",
          "community",
          "node_details",
          "pr_impact",
        ],
      },
      project_path: { type: "string" },
      question: { type: "string" },
      source: { type: "string" },
      target: { type: "string" },
      community_id: { type: "number" },
      label: { type: "string" },
      pr_number: { type: "number" },
      depth: { type: "number" },
      max_hops: { type: "number" },
    },
    required: ["action", "project_path"],
  },
  allowedRoles: ["Architect", "Engineer"],
  requiredScopes: ["graph", "query"],
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const action = args["action"];
    const projectPath = args["project_path"];

    if (typeof action !== "string" || typeof projectPath !== "string") {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              ok: false,
              error: "action and project_path are required",
            }),
          },
        ],
      };
    }

    const client = new GraphifyClient({ projectPath });

    try {
      if (action === "graph_stats") {
        const graph = client.read();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ok: true,
                tool: "glide_graph",
                action,
                project_path: projectPath,
                node_count: graph.nodes.length,
                edge_count: graph.links.length,
                communities: Array.from(
                  new Set(
                    graph.nodes
                      .map((n) => n.community)
                      .filter((c): c is number => typeof c === "number")
                  )
                ).sort((a, b) => a - b),
              }),
            },
          ],
        };
      }

      if (action === "query") {
        const question = typeof args["question"] === "string" ? args["question"] : "";
        const depth = typeof args["depth"] === "number" ? args["depth"] : 2;
        const result = client.query(question, depth);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ok: true,
                tool: "glide_graph",
                action,
                project_path: projectPath,
                question,
                nodes: result.nodes.map((n) => ({
                  id: n.id,
                  label: n.label,
                  community: n.community,
                })),
                edges: result.edges.map((e) => ({
                  source: e.source,
                  target: e.target,
                  relation: e.relation,
                })),
              }),
            },
          ],
        };
      }

      if (action === "shortest_path") {
        const source = typeof args["source"] === "string" ? args["source"] : "";
        const target = typeof args["target"] === "string" ? args["target"] : "";
        const maxHops = typeof args["max_hops"] === "number" ? args["max_hops"] : 6;

        if (!source || !target) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  ok: false,
                  error: "source and target are required for shortest_path",
                }),
              },
            ],
          };
        }

        const path = client.shortestPath(source, target, maxHops);
        if (!path) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  ok: true,
                  tool: "glide_graph",
                  action,
                  project_path: projectPath,
                  source,
                  target,
                  path: null,
                }),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ok: true,
                tool: "glide_graph",
                action,
                project_path: projectPath,
                source,
                target,
                hops: path.hops,
                path: path.path.map((n) => ({
                  id: n.id,
                  label: n.label,
                  community: n.community,
                })),
              }),
            },
          ],
        };
      }

      if (action === "community") {
        const communityId =
          typeof args["community_id"] === "number"
            ? args["community_id"]
            : Number(args["community_id"] ?? NaN);
        if (Number.isNaN(communityId)) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  ok: false,
                  error: "community_id is required for community",
                }),
              },
            ],
          };
        }
        const nodes = client.community(communityId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ok: true,
                tool: "glide_graph",
                action,
                project_path: projectPath,
                community_id: communityId,
                count: nodes.length,
                nodes: nodes.map((n) => ({
                  id: n.id,
                  label: n.label,
                  community_name: n.community_name,
                })),
              }),
            },
          ],
        };
      }

      if (action === "node_details") {
        const label = typeof args["label"] === "string" ? args["label"] : "";
        if (!label) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  ok: false,
                  error: "label is required for node_details",
                }),
              },
            ],
          };
        }
        const node = client.nodeDetails(label);
        if (!node) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  ok: true,
                  tool: "glide_graph",
                  action,
                  project_path: projectPath,
                  node: null,
                }),
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ok: true,
                tool: "glide_graph",
                action,
                project_path: projectPath,
                node: {
                  id: node.id,
                  label: node.label,
                  file_type: node.file_type,
                  source_file: node.source_file,
                  source_location: node.source_location,
                  community: node.community,
                  community_name: node.community_name,
                },
              }),
            },
          ],
        };
      }

      if (action === "pr_impact") {
        const prNumber =
          typeof args["pr_number"] === "number"
            ? args["pr_number"]
            : Number(args["pr_number"] ?? NaN);
        if (Number.isNaN(prNumber)) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  ok: false,
                  error: "pr_number is required for pr_impact",
                }),
              },
            ],
          };
        }
        const impact = client.prImpact(prNumber);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ok: true,
                tool: "glide_graph",
                action,
                project_path: projectPath,
                ...impact,
              }),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              ok: false,
              error: `Unsupported graph action: ${action}`,
            }),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              ok: false,
              tool: "glide_graph",
              action,
              project_path: projectPath,
              error: message,
            }),
          },
        ],
      };
    }
  },
};
