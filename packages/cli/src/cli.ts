#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

interface Args {
  _: string[];
  json?: boolean;
  help?: boolean;
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
  "init",
  "goal",
  "headroom",
  "executor",
  "tracer",
  "permissions",
  "plan",
  "build",
  "test",
  "review",
  "ship",
  "converge",
  "gates",
  "status",
] as const;

type Command = (typeof COMMANDS)[number];

function resolveCommand(input: string): Command | undefined {
  const normalized = input.toLowerCase();
  for (const cmd of COMMANDS) {
    if (cmd === normalized) {
      return cmd;
    }
  }
  return undefined;
}

function printHelp(): void {
  console.log(`glide — Glide MCP stdio CLI

Usage:
  glide <command> [options] [args...]
  glide --help

Global options:
  --json     Emit raw JSON output instead of formatted text
  --help     Show this help message

Commands:
  init            Initialize a new Glide campaign/project
  goal set <dir> <goal>    Set primary campaign goal
  goal get <dir>           Get primary campaign goal
  headroom        Inspect headroom constraints
  executor        Inspect executor runtime
  tracer          Inspect tracer/runtime state
  permissions     Inspect permission settings
  plan            Generate campaign plan artifact
  build           Record a build artifact
  test            Record a test artifact
  review          Record a review artifact
  ship            Record a ship artifact
  converge        Inspect convergence status
  gates           Inspect quality gates
  status          Show overall Glide system status

Aliases:
  set    -> goal set
  get    -> goal get

Examples:
  glide status
  glide goal set /tmp/campaign "Ship the feature"
  glide plan /tmp/campaign --json
`);
}

function printCommandHelp(command: Command): void {
  switch (command) {
    case "init":
      console.log(`glide init

Initialize a new Glide campaign/project in the given directory.

Usage:
  glide init <dir> [goal]

Options:
  --json     Emit raw JSON output
`);
      break;
    case "goal":
      console.log(`glide goal

Manage campaign goal.

Usage:
  glide goal set <dir> <goal>    Set goal
  glide goal get <dir>           Get goal

Options:
  --json     Emit raw JSON output
`);
      break;
    case "headroom":
    case "executor":
    case "tracer":
    case "permissions":
      console.log(`glide ${command}

Inspect ${command} state via the Glide control plane.

Usage:
  glide ${command} [args...]

Options:
  --json     Emit raw JSON output
`);
      break;
    case "plan":
      console.log(`glide plan

Generate a campaign plan artifact.

Usage:
  glide plan <campaign_dir> <epic> [--summary <text>] [--teams <n1,n2>] [--agents <n1,n2>]

Options:
  --json     Emit raw JSON output
`);
      break;
    case "build":
    case "test":
    case "review":
    case "ship":
      console.log(`glide ${command}

Record a ${command} artifact for a campaign.

Usage:
  glide ${command} <campaign_dir> [--team <name>] [--status <text>] [--notes <text>]

Options:
  --json     Emit raw JSON output
`);
      break;
    case "converge":
    case "gates":
    case "status":
      console.log(`glide ${command}

Show ${command} information.

Usage:
  glide ${command}

Options:
  --json     Emit raw JSON output
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
    "./packages/mcp-server/dist/index.js",
    "../mcp-server/dist/index.js",
    "../../packages/mcp-server/dist/index.js",
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return "./packages/mcp-server/dist/index.js";
}

function extractNamedArgs(argv: string[]): { named: Record<string, string>; positional: string[] } {
  const named: Record<string, string> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--") && i + 1 < argv.length && !argv[i + 1].startsWith("-")) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      named[key] = value;
      i++;
    } else if (arg.startsWith("--")) {
      const key = arg.slice(2);
      named[key] = "true";
    } else {
      positional.push(arg);
    }
  }
  return { named, positional };
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
  let command: Command | undefined;
  let remaining: string[];

  if (rawCommand === "set" || rawCommand === "get") {
    command = "goal";
    remaining = [rawCommand, ...args._.slice(1)];
  } else {
    command = resolveCommand(rawCommand);
    remaining = args._.slice(1);
  }

  if (!command) {
    console.error(`Error: Unknown command '${rawCommand}'. Run 'glide --help' for usage.`);
    process.exit(2);
    return;
  }

  if (args.help) {
    if (command && remaining.length > 0) {
      printCommandHelp(command);
    } else {
      printHelp();
    }
    process.exit(0);
    return;
  }

  let resolvedToolName = "";
  let resolvedMappedArgs: Record<string, JsonValue> = {};

  try {
    switch (command) {
      case "init": {
        if (remaining.length === 0) {
          console.error("Error: init requires <dir> [goal]");
          process.exit(2);
          return;
        }
        resolvedToolName = "glide_goal_set";
        resolvedMappedArgs = {
          campaign_dir: remaining[0],
          goal: remaining[1] ?? `Glide campaign initialized at ${new Date().toISOString()}`,
        };
        break;
      }
      case "goal": {
        const sub = remaining[0];
        if (!sub || (sub !== "set" && sub !== "get")) {
          console.error("Error: goal requires 'set' or 'get'");
          process.exit(2);
          return;
        }
        if (sub === "set") {
          resolvedToolName = "glide_goal_set";
          if (remaining.length < 2) {
            console.error("Error: goal set requires <dir> <goal>");
            process.exit(2);
            return;
          }
          resolvedMappedArgs = { campaign_dir: remaining[1], goal: remaining[2] };
        } else {
          resolvedToolName = "glide_goal_get";
          if (remaining.length < 1) {
            console.error("Error: goal get requires <dir>");
            process.exit(2);
            return;
          }
          resolvedMappedArgs = { campaign_dir: remaining[1] };
        }
        break;
      }
      case "headroom": {
        resolvedToolName = "glide_headroom";
        const { named } = extractNamedArgs(remaining);
        resolvedMappedArgs = { ...named };
        break;
      }
      case "executor": {
        resolvedToolName = "glide_executor";
        const { named } = extractNamedArgs(remaining);
        resolvedMappedArgs = { ...named };
        break;
      }
      case "tracer": {
        resolvedToolName = "glide_tracer";
        const { named } = extractNamedArgs(remaining);
        resolvedMappedArgs = { ...named };
        break;
      }
      case "permissions": {
        resolvedToolName = "glide_permissions";
        const { named } = extractNamedArgs(remaining);
        resolvedMappedArgs = { ...named };
        break;
      }
      case "plan": {
        resolvedToolName = "glide_plan";
        if (remaining.length === 0) {
          console.error("Error: plan requires <campaign_dir>");
          process.exit(2);
          return;
        }
        const { named, positional } = extractNamedArgs(remaining);
        resolvedMappedArgs = { campaign_dir: remaining[0], ...named };
        if (!named.epic && positional.length > 0) {
          resolvedMappedArgs.epic = positional[0];
        }
        if (named.summary) resolvedMappedArgs.summary = named.summary;
        if (named.teams) resolvedMappedArgs.teams = named.teams.split(",");
        if (named.agents) resolvedMappedArgs.agents = named.agents.split(",");
        break;
      }
      case "build":
      case "test":
      case "review":
      case "ship": {
        resolvedToolName = `glide_${command}`;
        if (remaining.length === 0) {
          console.error(`Error: ${command} requires <campaign_dir>`);
          process.exit(2);
          return;
        }
        const { named } = extractNamedArgs(remaining);
        resolvedMappedArgs = { campaign_dir: remaining[0], ...named };
        break;
      }
      case "converge": {
        resolvedToolName = "glide_converge";
        const { named } = extractNamedArgs(remaining);
        resolvedMappedArgs = { ...named };
        break;
      }
      case "gates": {
        resolvedToolName = "glide_gates";
        const { named } = extractNamedArgs(remaining);
        resolvedMappedArgs = { ...named };
        break;
      }
      case "status": {
        resolvedToolName = "glide_status";
        resolvedMappedArgs = {};
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
    if (args.json) {
      console.log(JSON.stringify(envelope.result, null, 2));
    } else {
      console.log("No content returned.");
    }
    process.exit(0);
    return;
  }

  const text = result.content[0]?.text ?? "";
  if (args.json) {
    console.log(text);
    process.exit(0);
    return;
  }

  try {
    const parsed = JSON.parse(text);
    console.log(JSON.stringify(parsed, null, 2));
  } catch {
    console.log(text);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(`Fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
