import { readFileSync, readdirSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const TRACE_STORE = new Map<
  string,
  { agentId: string; action: string; status: string; detail: string }[]
>();

function recordTrace(
  campaignId: string,
  agentId: string,
  action: string,
  status: string,
  detail = ""
): void {
  const list = TRACE_STORE.get(campaignId) ?? [];
  list.push({ agentId, action, status, detail });
  TRACE_STORE.set(campaignId, list);
}

export interface AgentTrace {
  agentId: string;
  goal: string;
  notes: string[];
  todos: string[];
  parentId: string;
  children: string[];
  depth: number;
}

export interface TraceEvent {
  agentId: string;
  action: string;
  status: string;
  detail: string;
  timestamp: string;
}

export interface SessionTraceLoggerOptions {
  rootDir?: string;
  file?: string;
}

export class SessionTraceLogger {
  private readonly filePath: string;

  constructor(options: SessionTraceLoggerOptions = {}) {
    const rootDir = options.rootDir ?? ".glide-sessions";
    const file = options.file ?? "trace-events.jsonl";
    if (!existsSync(rootDir)) {
      mkdirSync(rootDir, { recursive: true });
    }
    this.filePath = join(rootDir, file);
  }

  log(event: Omit<TraceEvent, "timestamp">): void {
    appendFileSync(
      this.filePath,
      JSON.stringify({ ...event, timestamp: new Date().toISOString() }) + "\n",
      "utf8"
    );
  }

  readAll(): TraceEvent[] {
    if (!existsSync(this.filePath)) {
      return [];
    }
    const raw = readFileSync(this.filePath, "utf8");
    const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
    return lines.map((line) => JSON.parse(line) as TraceEvent);
  }
}

let sessionTraceLogger: SessionTraceLogger | null = null;

export function getSessionTraceLogger(
  options?: SessionTraceLoggerOptions
): SessionTraceLogger {
  if (!sessionTraceLogger) {
    sessionTraceLogger = new SessionTraceLogger(options);
  }
  return sessionTraceLogger;
}

export function setSessionTraceLogger(logger: SessionTraceLogger | null): void {
  sessionTraceLogger = logger;
}

export function traceAgent(options: {
  workspace: string;
  agentId: string;
  depth?: number;
  sessionId?: string;
}): AgentTrace {
  const { workspace, agentId, depth = 3, sessionId } = options;
  const agentDir = join(workspace, "agents", agentId);

  if (!existsSync(agentDir) || !existsSync(join(agentDir, "GOAL.md"))) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  const goal = readFileSync(join(agentDir, "GOAL.md"), "utf8");
  const notes = readLines(join(agentDir, "NOTES.md"));
  const todos = readLines(join(agentDir, "TODO.md"));

  const personality = readFileSync(join(agentDir, "PERSONALITY.md"), "utf8");
  const parentMatch = personality.match(/Parent:\s*([^\n]+)/);
  const parentId = parentMatch ? (parentMatch[1]?.trim() ?? "none") : "none";

  const children: string[] = [];
  if (depth > 1) {
    const agentsDir = join(workspace, "agents");
    if (existsSync(agentsDir)) {
      for (const entry of readdirSync(agentsDir)) {
        const childPersonality = join(agentsDir, entry, "PERSONALITY.md");
        if (existsSync(childPersonality)) {
          const text = readFileSync(childPersonality, "utf8");
          const childParentMatch = text.match(/Parent:\s*([^\n]+)/);
          const childParent = childParentMatch
            ? (childParentMatch[1]?.trim() ?? "none")
            : "none";
          if (childParent === agentId) {
            children.push(entry);
          }
        }
      }
    }
  }

  recordTrace("global", agentId, "trace.read", "ok", `traced ${agentId}`);

  try {
    getSessionTraceLogger().log({
      agentId,
      action: "trace.read",
      status: "ok",
      detail: `traced ${agentId}`,
    });
  } catch {
    // session logging is best-effort
  }

  return {
    agentId,
    goal,
    notes,
    todos,
    parentId,
    children,
    depth,
  };
}

export function indepthAgent(options: {
  workspace: string;
  agentId: string;
}): string {
  const trace = traceAgent(options);
  const lines = [
    `# Agent: ${trace.agentId}`,
    "",
    "## Goal",
    "",
    trace.goal,
    "",
    "## Parent",
    "",
    trace.parentId,
    "",
    "## Children",
    "",
    trace.children.length > 0 ? trace.children.join(", ") : "none",
    "",
    "## Notes",
    "",
    ...(trace.notes.length > 0 ? trace.notes : ["(none)"]),
    "",
    "## Todos",
    "",
    ...(trace.todos.length > 0 ? trace.todos : ["(none)"]),
  ];
  return lines.join("\n");
}

function readLines(path: string): string[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
