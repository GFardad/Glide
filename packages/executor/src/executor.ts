import { spawn } from "node:child_process";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentHandle } from "./agent-handle.js";
import type { AgentMessage } from "./agent-message.js";
import { AgentStatus } from "./agent-status.js";
import { globalSessionEmitter } from "./session.js";

function randomId(): string {
  return `agent-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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

const agentRegistry = new Map<string, { child: ReturnType<typeof spawn>; killTimeoutMs?: number | undefined }>();

export interface SpawnAgentOptions {
  command: string;
  args?: string[];
  parentId?: string;
  cwd?: string;
  env?: Record<string, string | undefined>;
  ipcPath?: string;
  killTimeoutMs?: number;
  sessionId?: string;
}

export interface AgentResult {
  handle: AgentHandle;
  exitCode: number | null;
  error?: Error | undefined;
}

/**
 * Spawns a child agent process and returns a typed handle.
 *
 * Wire protocol (stdout/stderr):
 *   Each line should be a JSON-encoded AgentMessage.
 *   Any non-JSON output is ignored for protocol purposes.
 */
export function spawnAgent(options: SpawnAgentOptions): AgentHandle {
  const id = randomId();
  const createdAt = isoNow();
  const messages: AgentMessage[] = [];
  const handle: AgentHandle = {
    id,
    parentId: options.parentId,
    sessionId: options.sessionId,
    status: AgentStatus.Pending,
    createdAt,
    ipcPath: options.ipcPath,
    messages,
  };

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
    const parsed = parseLines(stderrBuffer);
    const newMessages = parsed.slice(messages.length);
    if (newMessages.length > 0) {
      messages.push(...newMessages);
    }
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
      globalSessionEmitter.fail(handle);
    } catch {
      // session logging is best-effort
    }
  });

  child.on("close", (code) => {
    const remainingStdout = parseLines(stdoutBuffer).slice(messages.length);
    const remainingStderr = parseLines(stderrBuffer).slice(messages.length);
    messages.push(...remainingStdout, ...remainingStderr);

    handle.returnCode = code ?? null;
    handle.completedAt = isoNow();

    if (child.killed) {
      handle.status = AgentStatus.Cancelled;
      try {
        globalSessionEmitter.cancel(handle);
      } catch {
        // session logging is best-effort
      }
    } else if (code === 0) {
      handle.status = AgentStatus.Completed;
      try {
        globalSessionEmitter.complete(handle);
      } catch {
        // session logging is best-effort
      }
    } else {
      handle.status = AgentStatus.Failed;
      try {
        globalSessionEmitter.fail(handle);
      } catch {
        // session logging is best-effort
      }
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
    }
    agentRegistry.delete(id);
  });

  child.on("spawn", () => {
    handle.status = AgentStatus.Running;
    try {
      globalSessionEmitter.create(handle);
    } catch {
      // session logging is best-effort
    }
  });

  agentRegistry.set(id, { child, killTimeoutMs: options.killTimeoutMs });
  return handle;
}

export function cancelAgent(handle: AgentHandle): void {
  const record = agentRegistry.get(handle.id);
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

export function awaitAgent(handle: AgentHandle): Promise<AgentResult> {
  return new Promise((resolve) => {
    if (handle.status !== AgentStatus.Pending && handle.status !== AgentStatus.Running) {
      return resolve({
        handle,
        exitCode: handle.returnCode ?? null,
        error: handle.status === AgentStatus.Failed ? new Error("Agent failed") : undefined,
      });
    }
    const check = () => {
      if (
        handle.status === AgentStatus.Completed ||
        handle.status === AgentStatus.Failed ||
        handle.status === AgentStatus.Cancelled
      ) {
        resolve({
          handle,
          exitCode: handle.returnCode ?? null,
          error: handle.status === AgentStatus.Failed ? new Error("Agent failed") : undefined,
        });
      } else {
        setTimeout(check, 50);
      }
    };
    check();
  });
}

export function createIpcPath(baseDir: string, handleId: string): string {
  const path = join(baseDir, `glide-agent-${handleId}.ipc`);
  writeFileSync(path, "");
  return path;
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

