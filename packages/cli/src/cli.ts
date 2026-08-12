#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

interface Args {
  _: string[];
  json?: boolean;
  help?: boolean;
  format?: "text" | "json";
  project?: string;
  campaignDir?: string;
}

interface CliError extends Error {
  code?: string | number;
}

interface ToolCallResult {
  content: Array<{ type: string; text: string }>;
}

interface JsonRpcEnvelope {
  jsonrpc: "2.0";
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown>;
  result?: JsonValue;
  error?: { code: number; message: string };
}

const COMMANDS = [
  "status",
  "goal-set",
  "goal-get",
  "headroom",
  "plan",
  "build",
  "test",
  "review",
  "ship",
  "trace",
  "indepth",
  "permissions",
  "graph",
  "set",
  "get",
] as const;

type Command = (typeof COMMANDS)[number];

function resolveCommand(input: string): Command | undefined {
  const normalized = input.toLowerCase();
  return COMMANDS.includes(normalized as Command) ? (normalized as Command) : undefined;
}

function printHelp(): void {
  console.log(`glide — Glide MCP stdio CLI

Usage:
  glide <command> [options] [args...]
  glide --help

Global options:
  --project <path>        Project path for graph/status queries
  --campaign-dir <dir>    Default campaign directory
  --format <text|json>    Output format (default: text)
  --json                  Alias for --format json
  --help                  Show this help message

Commands:
  status                    Show overall Glide system status
  goal-set <dir> <goal>     Set primary campaign goal
  goal-get <dir>            Get primary campaign goal
  headroom <dir> <objective> Run a Headroom meeting
  plan <dir> <epic>         Generate campaign plan artifact
  build <dir>               Record a build artifact
  test <dir>                Record a test artifact
  review <dir> <decision>   Record a review artifact
  ship <dir> <target>       Record a ship artifact
  trace <workspace> <id>    Trace agent chain upward
  indepth <workspace> <id>  Dump agent context to markdown
  permissions <action> <resource> <subject_id> <subject_role>
                            Check authorization
  graph <action> <project_path>
                            Query knowledge graph (query|path|community|node|pr_impact)

Aliases:
  set    -> goal-set
  get    -> goal-get
`);
}

function printCommandHelp(command: Command): void {
  switch (command) {
    case "status":
      console.log(`glide status

Show overall Glide system status.

Usage:
  glide status [--project <path>]

Options:
  --project <path>        Project path for graphify stats
  --format <text|json>    Output format
`);
      break;
    case "goal-set":
    case "goal-get":
      console.log(`glide ${command}

${command === "goal-set" ? "Set" : "Get"} the primary campaign goal.

Usage:
  glide ${command} <campaign_dir>${command === "goal-set" ? " <goal>" : ""}

Options:
  --format <text|json>    Output format
`);
      break;
    case "set":
    case "get":
      console.log(`glide ${command}

Alias for goal-${command}.

Usage:
  glide ${command} <campaign_dir>${command === "set" ? " <goal>" : ""}

Options:
  --format <text|json>    Output format
`);
      break;
    case "headroom":
      console.log(`glide headroom

Run a Headroom meeting with the CTO and specialist agents.

Usage:
  glide headroom <campaign_dir> <objective> [--roles <a,b,c>]

Options:
  --roles <a,b>           Comma-separated roles
  --format <text|json>    Output format
`);
      break;
    case "plan":
      console.log(`glide plan

Generate a campaign plan artifact.

Usage:
  glide plan <campaign_dir> <epic> [--summary <text>] [--teams <a,b>] [--agents <a,b>]

Options:
  --summary <text>        Epic summary
  --teams <a,b>           Team names
  --agents <a,b>          Agent names
  --format <text|json>    Output format
`);
      break;
    case "build":
      console.log(`glide build

Record a build artifact for a campaign.

Usage:
  glide build <campaign_dir> [--team <name>] [--status <text>] [--notes <text>]

Options:
  --team <name>           Team name
  --status <text>         Build status
  --notes <text>          Build notes
  --format <text|json>    Output format
`);
      break;
    case "test":
      console.log(`glide test

Record a test artifact for a campaign.

Usage:
  glide test <campaign_dir> [--team <name>] [--passed] [--summary <text>]

Options:
  --team <name>           Team name
  --passed                Mark test as passed
  --summary <text>        Test summary
  --format <text|json>    Output format
`);
      break;
    case "review":
      console.log(`glide review

Record a review artifact for a campaign.

Usage:
  glide review <campaign_dir> <decision> [--reviewer <name>] [--notes <text>]

Options:
  --reviewer <name>       Reviewer name
  --notes <text>          Review notes
  --format <text|json>    Output format
`);
      break;
    case "ship":
      console.log(`glide ship

Record a ship artifact for a campaign.

Usage:
  glide ship <campaign_dir> <target> [--status <text>] [--notes <text>]

Options:
  --status <text>         Ship status
  --notes <text>          Ship notes
  --format <text|json>    Output format
`);
      break;
    case "trace":
      console.log(`glide trace

Trace an agent chain upward toward Headroom.

Usage:
  glide trace <workspace> <agent_id> [--file-path <path>] [--line <n>]

Options:
  --file-path <path>      File path for context
  --line <n>              Line number for context
  --format <text|json>    Output format
`);
      break;
    case "indepth":
      console.log(`glide indepth

Dump an agent's full context to markdown.

Usage:
  glide indepth <workspace> <agent_id> [--output-dir <path>]

Options:
  --output-dir <path>     Output directory
  --format <text|json>    Output format
`);
      break;
    case "permissions":
      console.log(`glide permissions

Check whether a subject is authorized for an action on a resource.

Usage:
  glide permissions <action> <resource> <subject_id> <subject_role>

Options:
  --format <text|json>    Output format
`);
      break;
    case "graph":
      console.log(`glide graph

Query the Glide project knowledge graph.

Usage:
  glide graph <action> <project_path> [args...]

Actions:
  query   --question <text> [--depth <n>]
  path    --source <text> --target <text> [--max-hops <n>]
  community --community-id <n>
  node    --label <text>
  pr_impact --pr-number <n>

Options:
  --format <text|json>    Output format
`);
      break;
  }
}

function parseArgs(argv: string[]): Args {
  const args: Args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") {
      args.json = true;
      args.format = "json";
    } else if (arg === "--format" && i + 1 < argv.length) {
      const value = argv[i + 1].toLowerCase();
      if (value === "text" || value === "json") {
        args.format = value;
        i++;
      } else {
        args._.push(arg);
      }
    } else if (arg === "--project" && i + 1 < argv.length) {
      args.project = argv[i + 1];
      i++;
    } else if (arg === "--campaign-dir" && i + 1 < argv.length) {
      args.campaignDir = argv[i + 1];
      i++;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      args._.push(arg);
    }
  }
  return args;
}

function findMcpServer(): string {
  const candidates = [
    "./packages/mcp-server/dist/cli.js",
    "../mcp-server/dist/cli.js",
    "../../packages/mcp-server/dist/cli.js",
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return join(resolve(candidate));
    }
  }
  return join(resolve("./packages/mcp-server/dist/cli.js"));
}

function requirePositional(positional: string[], index: number, name: string): string {
  if (index >= positional.length) {
    console.error(`Error: ${name} is required.`);
    process.exit(2);
  }
  return positional[index]!;
}

function readFlag(named: Record<string, string>, key: string, fallback = ""): string {
  return named[key] ?? fallback;
}

function readFlagJson(named: Record<string, string>, key: string): JsonValue {
  const value = named[key];
  if (value === "true") return true;
  if (value === "false") return false;
  const num = Number(value);
  if (!Number.isNaN(num) && value.trim() !== "") {
    return num;
  }
  return value;
}

async function sendInitialize(child: ReturnType<typeof spawn>): Promise<JsonRpcEnvelope> {
  return sendWithId(child, 1, {
    jsonrpc: "2.0",
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "glide-cli", version: "0.1.0" },
    },
    id: 1,
  });
}

async function sendToolCall(child: ReturnType<typeof spawn>, name: string, args: Record<string, JsonValue>): Promise<JsonRpcEnvelope> {
  return sendWithId(child, 2, {
    jsonrpc: "2.0",
    method: "tools/call",
    params: { name, arguments: args },
    id: 2,
  });
}

async function sendWithId(child: ReturnType<typeof spawn>, expectedId: number, envelope: JsonRpcEnvelope): Promise<JsonRpcEnvelope> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    let settled = false;

    function handleData(chunk: string): void {
      buffer += chunk;
      let boundary: number;
      while ((boundary = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, boundary).trim();
        buffer = buffer.slice(boundary + 1);
        if (line.length === 0) continue;
        try {
          const parsed = JSON.parse(line) as JsonRpcEnvelope;
          if (settled) continue;
          if (parsed.id === expectedId || parsed.error || parsed.result) {
            settled = true;
            cleanup();
            resolve(parsed);
          }
        } catch {
          // ignore malformed
        }
      }
    }

    const onData = (chunk: Buffer) => handleData(chunk.toString("utf8"));
    child.stdout?.on("data", onData);

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(new Error(`Timeout waiting for response to id=${expectedId}`));
      }
    }, 10000);

    function cleanup(): void {
      clearTimeout(timeout);
      child.stdout?.off("data", onData);
    }

    try {
      child.stdin?.write(JSON.stringify(envelope) + "\n");
    } catch (err) {
      if (!settled) {
        settled = true;
        cleanup();
        reject(err);
      }
    }
  });
}

async function callTool(name: string, args: Record<string, JsonValue>): Promise<JsonRpcEnvelope> {
  const child = spawn("node", [findMcpServer()], {
    stdio: ["pipe", "pipe", "inherit"],
  });

  try {
    const initEnvelope = await sendInitialize(child);
    if (initEnvelope.error) {
      return initEnvelope;
    }

    const result = await sendToolCall(child, name, args);
    return result;
  } finally {
    child.kill("SIGTERM");
  }
}

function formatText(result: JsonValue): string {
  if (typeof result !== "object" || result === null) {
    return JSON.stringify(result, null, 2);
  }

  const record = result as Record<string, JsonValue>;
  const parts: string[] = [];
  const addLine = (label: string, value: JsonValue | undefined) => {
    if (value === undefined || value === null || value === "") return;
    parts.push(`${label}: ${typeof value === "object" ? JSON.stringify(value) : value}`);
  };

  if (record.status) addLine("status", record.status);
  if (record.ok !== undefined) addLine("ok", record.ok);
  if (record.tool) addLine("tool", record.tool);
  if (record.version) addLine("version", record.version);
  if (record.phase) addLine("phase", record.phase);
  if (record.path) addLine("path", record.path);
  if (record.goal) addLine("goal", record.goal);
  if (record.epic) addLine("epic", record.epic);
  if (record.agent_id) addLine("agent_id", record.agent_id);
  if (record.campaign_id) addLine("campaign_id", record.campaign_id);
  if (record.subject_id) addLine("subject_id", record.subject_id);
  if (record.error) addLine("error", record.error);
  if (record.message) addLine("message", record.message);
  if (record.missing_artifacts) addLine("missing_artifacts", record.missing_artifacts);
  if (record.drift_detected !== undefined) addLine("drift_detected", record.drift_detected);
  if (record.summary && typeof record.summary === "object") {
    parts.push(`summary: ${JSON.stringify(record.summary)}`);
  }
  if (record.tree && typeof record.tree === "object") {
    parts.push(`tree: ${JSON.stringify(record.tree)}`);
  }
  if (record.trace && typeof record.trace === "object") {
    parts.push(`trace: ${JSON.stringify(record.trace)}`);
  }
  if (record.nodes && Array.isArray(record.nodes)) {
    parts.push(`nodes: ${JSON.stringify(record.nodes)}`);
  }
  if (record.edges && Array.isArray(record.edges)) {
    parts.push(`edges: ${JSON.stringify(record.edges)}`);
  }
  if (record.path && Array.isArray(record.path)) {
    parts.push(`path: ${JSON.stringify(record.path)}`);
  }
  if (record.chain && Array.isArray(record.chain)) {
    parts.push(`chain: ${JSON.stringify(record.chain)}`);
  }
  if (record.hops !== undefined) addLine("hops", record.hops);

  if (parts.length === 0) {
    return JSON.stringify(record, null, 2);
  }

  return parts.join("\n");
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    printHelp();
    process.exit(0);
    return;
  }

  let args: Args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    console.error(`Error: ${(err as CliError).message}`);
    process.exit(2);
    return;
  }

  if (args.help || args._.length === 0) {
    printHelp();
    process.exit(0);
    return;
  }

  const rawCommand = args._[0];
  const aliasMap: Record<string, Command> = {
    set: "goal-set",
    get: "goal-get",
  };
  let command = resolveCommand(rawCommand) ?? resolveCommand(aliasMap[rawCommand] ?? "");
  if (!command) {
    console.error(`Error: Unknown command '${rawCommand}'. Run 'glide --help' for usage.`);
    process.exit(2);
    return;
  }
  if (command === "set") command = "goal-set";
  if (command === "get") command = "goal-get";

  if (args.help) {
    printCommandHelp(command);
    process.exit(0);
    return;
  }

  const remaining = args._.slice(1);
  const globalNamed: Record<string, string> = {};
  const globalPositional: string[] = [];
  for (let i = 0; i < remaining.length; i++) {
    const arg = remaining[i];
    if (arg.startsWith("--") && i + 1 < remaining.length && !remaining[i + 1]?.startsWith("-")) {
      const key = arg.slice(2);
      globalNamed[key] = remaining[i + 1]!;
      i++;
    } else if (arg.startsWith("--")) {
      const key = arg.slice(2);
      globalNamed[key] = "true";
    } else {
      globalPositional.push(arg);
    }
  }

  const outputFormat = args.format ?? (args.json ? "json" : "text");

  let resolvedToolName = "";
  let resolvedMappedArgs: Record<string, JsonValue> = {};

  try {
    switch (command) {
      case "status": {
        resolvedToolName = "glide_status";
        resolvedMappedArgs = {};
        if (args.project) resolvedMappedArgs.project_path = args.project;
        break;
      }
      case "goal-set": {
        const dir = readFlag(globalNamed, "campaign-dir", args.campaignDir ?? requirePositional(globalPositional, 0, "campaign_dir"));
        const goal = readFlag(globalNamed, "goal", requirePositional(globalPositional, 1, "goal"));
        resolvedToolName = "glide_goal_set";
        resolvedMappedArgs = { campaign_dir: dir, goal };
        break;
      }
      case "goal-get": {
        const dir = readFlag(globalNamed, "campaign-dir", args.campaignDir ?? requirePositional(globalPositional, 0, "campaign_dir"));
        resolvedToolName = "glide_goal_get";
        resolvedMappedArgs = { campaign_dir: dir };
        break;
      }
      case "headroom": {
        const dir = readFlag(globalNamed, "campaign-dir", args.campaignDir ?? requirePositional(globalPositional, 0, "campaign_dir"));
        const objective = readFlag(globalNamed, "objective", requirePositional(globalPositional, 1, "objective"));
        resolvedToolName = "glide_headroom";
        resolvedMappedArgs = { campaign_dir: dir, objective };
        if (globalNamed.roles) {
          resolvedMappedArgs.roles = globalNamed.roles.split(",");
        }
        break;
      }
      case "plan": {
        const dir = readFlag(globalNamed, "campaign-dir", args.campaignDir ?? requirePositional(globalPositional, 0, "campaign_dir"));
        const epic = readFlag(globalNamed, "epic", requirePositional(globalPositional, 1, "epic"));
        resolvedToolName = "glide_plan";
        resolvedMappedArgs = { campaign_dir: dir, epic };
        if (globalNamed.summary) resolvedMappedArgs.summary = globalNamed.summary;
        if (globalNamed.teams) resolvedMappedArgs.teams = globalNamed.teams.split(",");
        if (globalNamed.agents) resolvedMappedArgs.agents = globalNamed.agents.split(",");
        break;
      }
      case "build": {
        const dir = readFlag(globalNamed, "campaign-dir", args.campaignDir ?? requirePositional(globalPositional, 0, "campaign_dir"));
        resolvedToolName = "glide_build";
        resolvedMappedArgs = { campaign_dir: dir };
        if (globalNamed.team) resolvedMappedArgs.team = globalNamed.team;
        if (globalNamed.status) resolvedMappedArgs.status = globalNamed.status;
        if (globalNamed.notes) resolvedMappedArgs.notes = globalNamed.notes;
        break;
      }
      case "test": {
        const dir = readFlag(globalNamed, "campaign-dir", args.campaignDir ?? requirePositional(globalPositional, 0, "campaign_dir"));
        resolvedToolName = "glide_test";
        resolvedMappedArgs = { campaign_dir: dir };
        if (globalNamed.team) resolvedMappedArgs.team = globalNamed.team;
        if (globalNamed.passed) resolvedMappedArgs.passed = true;
        if (globalNamed.summary) resolvedMappedArgs.summary = globalNamed.summary;
        break;
      }
      case "review": {
        const dir = readFlag(globalNamed, "campaign-dir", args.campaignDir ?? requirePositional(globalPositional, 0, "campaign_dir"));
        const decision = readFlag(globalNamed, "decision", requirePositional(globalPositional, 1, "decision"));
        resolvedToolName = "glide_review";
        resolvedMappedArgs = { campaign_dir: dir, decision };
        if (globalNamed.reviewer) resolvedMappedArgs.reviewer = globalNamed.reviewer;
        if (globalNamed.notes) resolvedMappedArgs.notes = globalNamed.notes;
        break;
      }
      case "ship": {
        const dir = readFlag(globalNamed, "campaign-dir", args.campaignDir ?? requirePositional(globalPositional, 0, "campaign_dir"));
        const target = readFlag(globalNamed, "target", requirePositional(globalPositional, 1, "target"));
        resolvedToolName = "glide_ship";
        resolvedMappedArgs = { campaign_dir: dir, target };
        if (globalNamed.status) resolvedMappedArgs.status = globalNamed.status;
        if (globalNamed.notes) resolvedMappedArgs.notes = globalNamed.notes;
        break;
      }
      case "trace": {
        const workspace = requirePositional(globalPositional, 0, "workspace");
        const agentId = requirePositional(globalPositional, 1, "agent_id");
        resolvedToolName = "glide_trace";
        resolvedMappedArgs = { workspace, agent_id: agentId };
        if (globalNamed["file-path"]) resolvedMappedArgs.file_path = globalNamed["file-path"];
        if (globalNamed.line) resolvedMappedArgs.line = readFlagJson(globalNamed, "line");
        break;
      }
      case "indepth": {
        const workspace = requirePositional(globalPositional, 0, "workspace");
        const agentId = requirePositional(globalPositional, 1, "agent_id");
        resolvedToolName = "glide_indepth";
        resolvedMappedArgs = { workspace, agent_id: agentId };
        if (globalNamed["output-dir"]) resolvedMappedArgs.output_dir = globalNamed["output-dir"];
        break;
      }
      case "permissions": {
        const action = requirePositional(globalPositional, 0, "action");
        const resource = requirePositional(globalPositional, 1, "resource");
        const subjectId = requirePositional(globalPositional, 2, "subject_id");
        const subjectRole = requirePositional(globalPositional, 3, "subject_role");
        resolvedToolName = "glide_permissions";
        resolvedMappedArgs = { action, resource, subject_id: subjectId, subject_role: subjectRole };
        break;
      }
      case "graph": {
        const action = requirePositional(globalPositional, 0, "action");
        const projectPath = readFlag(globalNamed, "project_path", args.project ?? requirePositional(globalPositional, 1, "project_path"));
        resolvedToolName = "glide_graph";
        resolvedMappedArgs = { action, project_path: projectPath };
        if (globalNamed.question) resolvedMappedArgs.question = globalNamed.question;
        if (globalNamed.depth) resolvedMappedArgs.depth = readFlagJson(globalNamed, "depth");
        if (globalNamed.source) resolvedMappedArgs.source = globalNamed.source;
        if (globalNamed.target) resolvedMappedArgs.target = globalNamed.target;
        if (globalNamed.max_hops) resolvedMappedArgs.max_hops = readFlagJson(globalNamed, "max_hops");
        if (globalNamed["community-id"]) resolvedMappedArgs.community_id = readFlagJson(globalNamed, "community-id");
        if (globalNamed.label) resolvedMappedArgs.label = globalNamed.label;
        if (globalNamed["pr-number"]) resolvedMappedArgs.pr_number = readFlagJson(globalNamed, "pr-number");
        break;
      }
    }
  } catch (err) {
    console.error(`Error: ${(err as CliError).message}`);
    process.exit(2);
    return;
  }

  const envelope = await callTool(resolvedToolName, resolvedMappedArgs);

  if (envelope.error) {
    console.error(`Error [${envelope.error.code}]: ${envelope.error.message}`);
    process.exit(1);
    return;
  }

  const result = envelope.result as ToolCallResult | undefined;
  if (!result || !Array.isArray(result.content) || result.content.length === 0) {
    if (outputFormat === "json") {
      console.log(JSON.stringify(envelope.result, null, 2));
    } else {
      console.log("No content returned.");
    }
    process.exit(0);
    return;
  }

  const text = result.content[0]?.text ?? "";
  if (outputFormat === "json") {
    console.log(text);
    process.exit(0);
    return;
  }

  try {
    const parsed = JSON.parse(text);
    console.log(formatText(parsed));
  } catch {
    console.log(text);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(`Fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
