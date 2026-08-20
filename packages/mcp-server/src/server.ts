import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  StdioServerTransport,
} from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { tools } from "./tools/index.js";
import type { GlideTool } from "./tools/types.js";
import { PermissionRuntime, createSubject } from "@glide/permissions";
import {
  listPlugins,
  resolveRegistryPath,
  type MinimalPluginManifest,
} from "@glide/core";

const REQUEST_TIMEOUT_MS = 120_000;
const DEFAULT_PROJECT_ROOT = process.cwd();

const runtime = new PermissionRuntime();
const roleDefaults = new Map<string, string[]>([
  ["CEO", ["dashboard", "status", "graph", "headroom", "gates", "web_search"]],
  ["Architect", ["plan", "graph", "gates", "headroom"]],
  ["Engineer", ["build", "test", "executor", "trace", "gates"]],
  ["Security", ["gates", "permissions", "trace"]],
  ["QA", ["test", "gates", "trace", "review"]],
  ["Product", ["goal", "plan", "headroom"]],
]);

function parseToolArguments(tool: GlideTool, args: Record<string, unknown>): Record<string, unknown> {
  if (tool.inputSchema && tool.inputSchema.properties) {
    const parsed: Record<string, unknown> = {};
    const properties = tool.inputSchema.properties;
    const required = new Set(tool.inputSchema.required ?? []);
    for (const [key, schema] of Object.entries(properties)) {
      const value = args[key];
      if (value === undefined || value === null) {
        if (required.has(key)) {
          throw new Error(`Missing required argument: ${key}`);
        }
        continue;
      }
      const expectedType = (schema as { type?: string }).type;
      if (expectedType === "string" && typeof value !== "string") {
        throw new Error(`Invalid argument: ${key} must be a string`);
      }
      if (expectedType === "array" && !Array.isArray(value)) {
        throw new Error(`Invalid argument: ${key} must be an array`);
      }
      if (expectedType === "number" && typeof value !== "number") {
        throw new Error(`Invalid argument: ${key} must be a number`);
      }
      if (expectedType === "boolean" && typeof value !== "boolean") {
        throw new Error(`Invalid argument: ${key} must be a boolean`);
      }
      parsed[key] = value;
    }
    return parsed;
  }
  return args;
}

function resolveRoleFromArgs(args: Record<string, unknown>): string | undefined {
  const candidates = [
    args.subject_role,
    args.role,
    args.agent_role,
    args.roles,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
    if (Array.isArray(candidate) && candidate.length > 0 && typeof candidate[0] === "string") {
      return candidate[0].trim();
    }
  }
  return undefined;
}

function isToolAllowedForRole(tool: GlideTool, role?: string): boolean {
  if (!role) return true;
  if (tool.allowedRoles && tool.allowedRoles.length > 0) {
    return tool.allowedRoles.includes(role);
  }
  const defaultScopes = roleDefaults.get(role);
  if (!defaultScopes) return true;
  return defaultScopes.some((scope) => tool.name.toLowerCase().includes(scope));
}

function authorizeToolCall(tool: GlideTool, args: Record<string, unknown>): { ok: boolean; reason?: string } {
  const role = resolveRoleFromArgs(args);
  if (!isToolAllowedForRole(tool, role)) {
    return { ok: false, reason: `role_not_allowed: ${role ?? "unknown"}` };
  }

  const action = tool.name;
  const resource = (args.project_path as string | undefined) ??
    (args.campaign_dir as string | undefined) ??
    (args.workspace as string | undefined) ??
    DEFAULT_PROJECT_ROOT;

  const scopes = tool.requiredScopes ?? [];
  const subject = createSubject(role ?? "agent", scopes);
  return runtime.authorize(subject, { action, resource });
}

async function loadDynamicPlugins(root = DEFAULT_PROJECT_ROOT): Promise<GlideTool[]> {
  const registryPath = resolveRegistryPath({ root, filename: "registry.json" });
  const plugins: MinimalPluginManifest[] = [];
  try {
    const entries = listPlugins({ root, filename: "registry.json" });
    plugins.push(...entries);
  } catch {
    // dynamic plugins are optional
  }

  const dynamicTools: GlideTool[] = [];
  for (const plugin of plugins) {
    if (!plugin.entrypoint) continue;
    try {
      const mod = await import(plugin.entrypoint);
      const candidate = mod?.glidePluginTool ?? mod?.default;
      if (candidate && typeof candidate.handler === "function") {
        dynamicTools.push(candidate as GlideTool);
      }
    } catch {
      // skip plugins that fail to load
    }
  }
  return dynamicTools;
}

export function createGlideServer(pluginRoot = DEFAULT_PROJECT_ROOT): Server {
  let allTools = [...tools];

  const server = new Server(
    { name: "glide", version: "0.1.0" },
    { capabilities: { tools: { listChanged: false } } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = allTools.find((t) => t.name === request.params.name);
    if (!tool) {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }
    const arguments_ = request.params.arguments ?? {};
    const parsed = parseToolArguments(tool, arguments_ as Record<string, unknown>);
    const auth = authorizeToolCall(tool, parsed);
    if (!auth.ok) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ ok: false, error: auth.reason ?? "forbidden" }),
          },
        ],
      };
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const result = await tool.handler(parsed);
      return result;
    } finally {
      clearTimeout(timeoutId);
    }
  });

  loadDynamicPlugins(pluginRoot).then((dynamicTools) => {
    allTools = [...tools, ...dynamicTools];
  }).catch(() => {
    // dynamic plugins are optional
  });

  return server;
}

export async function main(): Promise<void> {
  const server = createGlideServer();
  const transport = new StdioServerTransport();

  server.oninitialized = () => {
    // SDK handles sending the initialized notification to the client
  };

  await server.connect(transport);

  process.on("SIGINT", () => {
    void server.close().then(() => process.exit(0));
  });

  process.on("SIGTERM", () => {
    void server.close().then(() => process.exit(0));
  });
}
