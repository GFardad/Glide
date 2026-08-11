import type { AgentHandle } from "./agent-handle.js";
import { existsSync, mkdirSync, appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type SessionEventType =
  | "session_created"
  | "session_resumed"
  | "session_event"
  | "session_completed"
  | "session_failed"
  | "session_cancelled"
  | "session_removed";

export interface SessionEvent {
  type: SessionEventType;
  handle: string;
  sessionId: string;
  timestamp: string;
  payload?: Record<string, unknown>;
}

export interface SessionEventWriterOptions {
  rootDir?: string | undefined;
  eventFile?: string | undefined;
}

export class SessionEventWriter {
  private readonly filePath: string;

  constructor(options: SessionEventWriterOptions = {}) {
    const rootDir = options.rootDir ?? ".glide-sessions";
    const eventFile = options.eventFile ?? "session-events.jsonl";
    if (!existsSync(rootDir)) {
      mkdirSync(rootDir, { recursive: true });
    }
    this.filePath = join(rootDir, eventFile);
  }

  write(event: SessionEvent): void {
    appendFileSync(this.filePath, JSON.stringify(event) + "\n", "utf8");
  }

  readAll(): SessionEvent[] {
    if (!existsSync(this.filePath)) {
      return [];
    }
    const raw = readFileSync(this.filePath, "utf8");
    const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
    return lines.map((line) => JSON.parse(line) as SessionEvent);
  }
}

export interface SessionEventEmitterOptions {
  rootDir?: string | undefined;
  eventFile?: string | undefined;
  enabled?: boolean | undefined;
}

export class SessionEventEmitter {
  private readonly writer: SessionEventWriter | null;
  private readonly enabled: boolean;

  constructor(options: SessionEventEmitterOptions = {}) {
    this.enabled = options.enabled ?? false;
    this.writer = options.enabled
      ? new SessionEventWriter({
          rootDir: options.rootDir,
          eventFile: options.eventFile,
        })
      : null;
  }

  emit(
    type: SessionEventType,
    handle: AgentHandle,
    extraPayload?: Record<string, unknown>
  ): void {
    if (!this.writer) return;
    const event: SessionEvent = {
      type,
      handle: handle.id,
      sessionId: handle.sessionId ?? handle.id,
      timestamp: new Date().toISOString(),
      payload: {
        status: handle.status,
        parentId: handle.parentId,
        ...extraPayload,
      },
    };
    this.writer.write(event);
  }

  create(handle: AgentHandle): void {
    this.emit("session_created", handle);
  }

  update(handle: AgentHandle, patch: Record<string, unknown>): void {
    this.emit("session_event", handle, patch);
  }

  complete(handle: AgentHandle): void {
    this.emit("session_completed", handle, {
      returnCode: handle.returnCode,
    });
  }

  fail(handle: AgentHandle): void {
    this.emit("session_failed", handle, {
      returnCode: handle.returnCode,
    });
  }

  cancel(handle: AgentHandle): void {
    this.emit("session_cancelled", handle);
  }
}

export const globalSessionEmitter = new SessionEventEmitter({
  enabled: process.env.GLIDE_SESSION_LOG_ENABLED === "true",
  rootDir: process.env.GLIDE_SESSION_LOG_DIR,
  eventFile: process.env.GLIDE_SESSION_LOG_FILE,
});
