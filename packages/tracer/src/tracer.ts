import { readFile, readdir, access } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { TraceEvent } from "./trace-runtime.js";
import { TraceRuntime } from "./trace-runtime.js";

export interface AgentTrace {
  agentId: string;
  goal: string;
  notes: string[];
  todos: string[];
  rejected: string[];
  parentId: string;
  children: string[];
  depth: number;
  sessionPath?: string | undefined;
}

export interface TracerRuntimeOptions {
  rootDir?: string;
  fileName?: string;
}

export interface TraceCorrelation {
  traceId?: string;
  spanId?: string;
  sessionId?: string;
}

const AgentIdSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const WorkspaceSchema = z.string().min(1).max(1024);

const TracerRuntimeOptionsSchema = z.object({
  workspace: WorkspaceSchema,
  agentId: AgentIdSchema,
  depth: z.number().int().nonnegative().max(10).default(3),
  sessionId: z.string().min(1).optional(),
});

export class TracerRuntime {
  private readonly traceRuntime: TraceRuntime;
  private readonly traceStore = new Map<
    string,
    { agentId: string; action: string; status: string; detail: string }[]
  >();
  /** Bound on in-memory trace entries to prevent unbounded growth (audit-perf #16). */
  private static readonly MAX_TRACE_ENTRIES = 10_000;

  constructor(options: TracerRuntimeOptions = {}) {
    this.traceRuntime = new TraceRuntime(options);
  }

  async log(
    event: Omit<TraceEvent, "_seq" | "_ts">,
    correlation?: TraceCorrelation
  ): Promise<void> {
    await this.traceRuntime.log(event, correlation);
  }

  async readAll(): Promise<TraceEvent[]> {
    return this.traceRuntime.readAll();
  }

  async clear(): Promise<void> {
    return this.traceRuntime.clear();
  }

  async traceAgent(options: {
    workspace: string;
    agentId: string;
    depth?: number;
    sessionId?: string;
  }): Promise<AgentTrace> {
    const validated = TracerRuntimeOptionsSchema.parse(options);
    const agentDir = join(validated.workspace, "agents", validated.agentId);

    try {
      await access(agentDir);
    } catch {
      throw new Error(`Agent not found: ${validated.agentId}`);
    }
    try {
      await access(join(agentDir, "GOAL.md"));
    } catch {
      throw new Error(`Agent not found: ${validated.agentId}`);
    }

    const goal = await readFile(join(agentDir, "GOAL.md"), "utf8");
    const notes = await readLines(join(agentDir, "NOTES.md"));
    const todos = await readLines(join(agentDir, "TODO.md"));
    const rejected = await readLines(join(agentDir, "REJECTED.md"));

    const personality = await readFile(join(agentDir, "PERSONALITY.md"), "utf8");
    const parentMatch = personality.match(/Parent:\s*([^\n]+)/);
    const parentId = parentMatch ? (parentMatch[1]?.trim() ?? "none") : "none";

    const children: string[] = [];
    if (validated.depth > 1) {
      const agentsDir = join(validated.workspace, "agents");
      try {
        await access(agentsDir);
      } catch {
        return {
          agentId: validated.agentId,
          goal,
          notes,
          todos,
          rejected,
          parentId,
          children: [],
          depth: validated.depth,
        };
      }
      const entries = await readdir(agentsDir);
      for (const entry of entries) {
        const childPersonality = join(agentsDir, entry, "PERSONALITY.md");
        try {
          await access(childPersonality);
        } catch {
          continue;
        }
        const text = await readFile(childPersonality, "utf8");
        const childParentMatch = text.match(/Parent:\s*([^\n]+)/);
        const childParent = childParentMatch
          ? (childParentMatch[1]?.trim() ?? "none")
          : "none";
        if (childParent === validated.agentId) {
          children.push(entry);
        }
      }
    }

    await this.recordTrace("global", validated.agentId, "trace.read", "ok", `traced ${validated.agentId}`);

    return {
      agentId: validated.agentId,
      goal,
      notes,
      todos,
      rejected,
      parentId,
      children,
      depth: validated.depth,
      sessionPath: validated.sessionId
        ? join(validated.workspace, "agents", validated.agentId, `session-${validated.sessionId}.jsonl`)
        : undefined,
    };
  }

  async indepthAgent(options: { workspace: string; agentId: string; sessionId?: string }): Promise<string> {
    const trace = await this.traceAgent(options);
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
      "",
      "## Rejected",
      "",
      ...(trace.rejected.length > 0 ? trace.rejected : ["(none)"]),
      "",
      "## Session Path",
      "",
      trace.sessionPath ?? "(none)",
    ];
    return lines.join("\n");
  }

  private async recordTrace(
    campaignId: string,
    agentId: string,
    action: string,
    status: string,
    detail = ""
  ): Promise<void> {
    let list = this.traceStore.get(campaignId);
    if (!list) {
      list = [];
      this.traceStore.set(campaignId, list);
    }
    list.push({ agentId, action, status, detail });
    // Evict oldest entries once the in-memory bound is exceeded.
    if (list.length > TracerRuntime.MAX_TRACE_ENTRIES) {
      list.splice(0, list.length - TracerRuntime.MAX_TRACE_ENTRIES);
    }
  }
}

export async function traceAgent(options: {
  workspace: string;
  agentId: string;
  depth?: number;
}): Promise<AgentTrace> {
  return new TracerRuntime().traceAgent(options);
}

export async function indepthAgent(options: { workspace: string; agentId: string; sessionId?: string }): Promise<string> {
  return new TracerRuntime().indepthAgent(options);
}

async function readLines(path: string): Promise<string[]> {
  try {
    await access(path);
  } catch {
    return [];
  }
  const raw = await readFile(path, "utf8");
  return raw.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
}

/**
 * @deprecated Prefer instantiating `new TracerRuntime(options)` directly.
 */
export function createTracer(options: TracerRuntimeOptions = {}): TracerRuntime {
  return new TracerRuntime(options);
}
