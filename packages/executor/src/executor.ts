import { spawn } from "node:child_process";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import type { AgentHandle } from "./agent-handle.js";
import type { AgentMessage } from "./agent-message.js";
import { AgentStatus } from "./agent-status.js";
import type { SessionEventEmitter, SessionStore } from "./session.js";
import { GraphifyClient } from "@glide/tracer";
import { ensureAgentContract } from "./runtime.js";
import { createAgentContext } from "./contract.js";

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `agent-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function generateTraceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `trace-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function generateSpanId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `span-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isoNow(): string {
  return new Date().toISOString();
}

function parseLines(buffer: string): AgentMessage[] {
  const messages: AgentMessage[] = [];
  const lines = buffer.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0) continue;
    try {
      const parsed = JSON.parse(line) as Partial<AgentMessage> & Record<string, unknown>;
      if (
        parsed &&
        typeof parsed.role === "string" &&
        ["system", "user", "assistant", "tool", "error"].includes(parsed.role) &&
        typeof parsed.content === "string"
      ) {
        const message: AgentMessage = {
          role: parsed.role as AgentMessage["role"],
          content: parsed.content,
          timestamp: typeof parsed.timestamp === "string" ? parsed.timestamp : isoNow(),
        };
        if (parsed.metadata && typeof parsed.metadata === "object") {
          message.metadata = parsed.metadata as Record<string, string>;
        }
        messages.push(message);
      }
    } catch {
      // skip non-JSON lines
    }
  }
  return messages;
}

export interface SpawnAgentOptions {
  command: string;
  args?: string[];
  parentId?: string;
  teamId?: string;
  cwd?: string;
  env?: Record<string, string | undefined>;
  ipcPath?: string;
  killTimeoutMs?: number;
  sessionId?: string;
  traceId?: string;
  spanId?: string;
  sessionEmitter?: SessionEventEmitter | null;
  graphifyClient?: GraphifyClient | null;
  timeoutMs?: number;
}

export interface AgentResult {
  handle: AgentHandle;
  exitCode: number | null;
  error?: Error | undefined;
}

export interface AgentExecutionContext {
  agent: AgentHandle;
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string | undefined>;
}

export async function groundWithGraphify(
  client: GraphifyClient | null | undefined,
  context: AgentExecutionContext
): Promise<void> {
  if (!client) return;

  try {
    const query = `${context.agent.sessionId ?? ""} ${context.command} ${(context.args ?? []).join(" ")}`.trim();
    if (query.length === 0) return;

    const { nodes } = client.query(query, 2);
    if (nodes.length === 0) return;

    const contextLines = nodes
      .slice(0, 10)
      .map((node) => `- ${node.label} (${node.source_file ?? "unknown"}): ${node.community_name ?? ""}`)
      .join("\n");

    context.agent.messages.push({
      role: "system",
      content: `Graphify grounding:\n${contextLines}`,
      timestamp: isoNow(),
      metadata: { kind: "graphify-grounding", nodeCount: String(nodes.length) },
    });
  } catch {
    // Graphify grounding is best-effort
  }
}

export interface ExecutorRuntimeOptions {
  sessionEmitter?: SessionEventEmitter | null;
}

export class ExecutorRuntime {
  private readonly agentRegistry = new Map<string, { child: ReturnType<typeof spawn>; killTimeoutMs?: number | undefined }>();
  private readonly sessionEmitter: SessionEventEmitter | null;

  constructor(options: ExecutorRuntimeOptions = {}) {
    this.sessionEmitter = options.sessionEmitter ?? null;
  }

  spawnAgent(options: SpawnAgentOptions): AgentHandle {
    const id = randomId();
    const traceId = options.traceId ?? generateTraceId();
    const spanId = options.spanId ?? generateSpanId();
    const createdAt = isoNow();
    const workspace = options.cwd ?? process.cwd();
    const messages: AgentMessage[] = [];
    const handle: AgentHandle = {
      id,
      parentId: options.parentId,
      sessionId: options.sessionId,
      status: AgentStatus.Pending,
      createdAt,
      ipcPath: options.ipcPath,
      messages,
      traceId,
      spanId,
    };

    const context: AgentExecutionContext = {
      agent: handle,
      command: options.command,
      args: options.args ?? [],
      cwd: workspace,
      env: options.env ?? {},
    };

    const contractContext = createAgentContext({
      agentId: id,
      sessionId: options.sessionId ?? id,
      cwd: workspace,
      ...(options.teamId !== undefined && { teamId: options.teamId }),
      ...(options.parentId !== undefined && { parentId: options.parentId }),
    });
    ensureAgentContract(workspace, contractContext);

    void groundWithGraphify(options.graphifyClient ?? null, context);

    const child = spawn(options.command, options.args ?? [], {
      cwd: options.cwd,
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdoutBuffer = "";
    let stderrBuffer = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuffer += chunk.toString("utf-8");
      const parsed = parseLines(stdoutBuffer);
      const newMessages = parsed.slice(messages.length);
      if (newMessages.length > 0) {
        messages.push(...newMessages);
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrBuffer += chunk.toString("utf-8");
    });

    child.on("error", (err) => {
      handle.status = AgentStatus.Failed;
      handle.completedAt = isoNow();
      handle.returnCode = child.exitCode ?? null;
      messages.push({
        role: "error",
        content: err.message,
        timestamp: isoNow(),
        metadata: { kind: "spawn-error" },
      });
      try {
        this.sessionEmitter?.fail(handle);
      } catch {
        // session logging is best-effort
      }
    });

    child.on("close", (code) => {
      const remainingStdout = parseLines(stdoutBuffer).slice(messages.length);
      messages.push(...remainingStdout);

      handle.returnCode = code ?? null;
      handle.completedAt = isoNow();

      if (stderrBuffer.trim().length > 0) {
        const last = messages[messages.length - 1];
        if (!last || last.role !== "error") {
          messages.push({
            role: "error",
            content: stderrBuffer.trim(),
            timestamp: isoNow(),
            metadata: { kind: "stderr" },
          });
        }
      }

      if (child.killed) {
        handle.status = AgentStatus.Cancelled;
        try {
          this.sessionEmitter?.cancel(handle);
        } catch {
          // session logging is best-effort
        }
      } else if (code === 0) {
        handle.status = AgentStatus.Completed;
        try {
          this.sessionEmitter?.complete(handle);
        } catch {
          // session logging is best-effort
        }
      } else {
        handle.status = AgentStatus.Failed;
        try {
          this.sessionEmitter?.fail(handle);
        } catch {
          // session logging is best-effort
        }
      }
      this.agentRegistry.delete(id);
      if (handle.ipcPath) {
        try {
          removeIpcPath(handle.ipcPath);
        } catch {
          // best-effort cleanup
        }
      }
    });

    child.on("spawn", () => {
      handle.status = AgentStatus.Running;
      try {
        this.sessionEmitter?.create(handle);
      } catch {
        // session logging is best-effort
      }
    });

    this.agentRegistry.set(id, { child, killTimeoutMs: options.killTimeoutMs });
    return handle;
  }

  cancelAgent(handle: AgentHandle): void {
    const record = this.agentRegistry.get(handle.id);
    const child = record?.child;
    if (!child || handle.status !== AgentStatus.Running) {
      return;
    }

    child.kill("SIGTERM");

    setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // already exited
      }
    }, record?.killTimeoutMs ?? 5000);
  }

  async awaitAgent(handle: AgentHandle, timeoutMs?: number): Promise<AgentResult> {
    return new Promise((resolve) => {
      const terminal = (): AgentResult => ({
        handle,
        exitCode: handle.returnCode ?? null,
        error: handle.status === AgentStatus.Failed ? new Error("Agent failed") : undefined,
      });

      if (handle.status !== AgentStatus.Pending && handle.status !== AgentStatus.Running) {
        return resolve(terminal());
      }

      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      if (typeof timeoutMs === "number" && timeoutMs > 0) {
        timeoutId = setTimeout(() => {
          resolve({
            handle,
            exitCode: handle.returnCode ?? null,
            error: new Error(`Agent await timed out after ${timeoutMs}ms`),
          });
        }, timeoutMs);
      }

      // Exponential backoff (50ms → 100ms → … cap 500ms) to avoid busy
      // polling millions of no-op timers during long agent runs.
      let delay = 50;
      const check = () => {
        if (
          handle.status === AgentStatus.Completed ||
          handle.status === AgentStatus.Failed ||
          handle.status === AgentStatus.Cancelled
        ) {
          if (timeoutId) clearTimeout(timeoutId);
          return resolve(terminal());
        }
        setTimeout(check, delay);
        delay = Math.min(delay * 2, 500);
      };
      check();
    });
  }
}

export function createIpcPath(baseDir: string, handleId: string): string {
  const sanitizedBaseDir = resolve(baseDir);
  if (!existsSync(sanitizedBaseDir)) {
    throw new Error(`IPC base directory does not exist: ${sanitizedBaseDir}`);
  }

  const sanitizedHandleId = handleId.replace(/[^A-Za-z0-9_-]/g, "");
  if (!sanitizedHandleId || sanitizedHandleId.length < 8) {
    throw new Error(`Invalid IPC handle ID; expected at least 8 alphanumeric characters`);
  }

  const path = join(sanitizedBaseDir, `glide-agent-${sanitizedHandleId}.ipc`);
  const resolvedPath = resolve(path);
  if (!resolvedPath.startsWith(sanitizedBaseDir + sep)) {
    throw new Error(`IPC path escapes base directory: ${resolvedPath}`);
  }

  writeFileSync(resolvedPath, "");
  return resolvedPath;
}

export function removeIpcPath(ipcPath: string): void {
  if (ipcPath && existsSync(ipcPath)) {
    try {
      unlinkSync(ipcPath);
    } catch {
      // ignore cleanup errors
    }
  }
}

export async function resumeAgent(
  handleId: string,
  options: {
    sessionStore: SessionStore;
    sessionEmitter: SessionEventEmitter;
    graphifyClient?: GraphifyClient | null;
  }
): Promise<AgentHandle | null> {
  const events = await options.sessionStore.readForHandle(handleId);
  if (events.length === 0) return null;

  const lastEvent = events[events.length - 1]!;
  if (lastEvent.type === "session_completed" || lastEvent.type === "session_failed") {
    return null;
  }

  const messages: AgentMessage[] = [];
  const handle: AgentHandle = {
    id: handleId,
    parentId: lastEvent.payload?.parentId as string | undefined,
    sessionId: lastEvent.sessionId,
    status: AgentStatus.Pending,
    createdAt: lastEvent.timestamp,
    traceId: lastEvent.traceId,
    spanId: lastEvent.spanId,
    messages,
  };

  return handle;
}

export async function propagateParentSummary(
  handle: AgentHandle,
  options: {
    sessionEmitter: SessionEventEmitter;
    parentId?: string | undefined;
  }
): Promise<void> {
  const summary = {
    agentId: handle.id,
    status: handle.status,
    messageCount: handle.messages.length,
  };

  await options.sessionEmitter.update(handle, {
    summary,
    propagatedTo: options.parentId ?? null,
  });
}



const defaultExecutor = new ExecutorRuntime();

export function spawnAgent(options: SpawnAgentOptions): AgentHandle {
  return defaultExecutor.spawnAgent(options);
}

export function cancelAgent(handle: AgentHandle): void {
  defaultExecutor.cancelAgent(handle);
}

export async function awaitAgent(handle: AgentHandle, timeoutMs?: number): Promise<AgentResult> {
  return defaultExecutor.awaitAgent(handle, timeoutMs);
}
