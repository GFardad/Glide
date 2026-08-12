import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { JsonlWriter } from "@glide/tracer";
import type { AgentHandle } from "./agent-handle.js";

export interface SessionEvent {
  type: string;
  handle: string;
  sessionId: string;
  timestamp: string;
  traceId?: string | undefined;
  spanId?: string | undefined;
  payload?: Record<string, unknown>;
}

export interface SessionEventWriterOptions {
  rootDir?: string | undefined;
  eventFile?: string | undefined;
  maxBytes?: number | undefined;
  maxFiles?: number | undefined;
}

export class SessionEventWriter {
  private readonly filePath: string;
  private nextSequence = 0;
  private readonly writer: JsonlWriter;

  constructor(options: SessionEventWriterOptions = {}) {
    const rootDir = options.rootDir ?? ".glide-sessions";
    const eventFile = options.eventFile ?? "session-events.jsonl";
    this.filePath = join(rootDir, eventFile);
    this.writer = new JsonlWriter({
      rootDir,
      fileName: eventFile,
      maxBytes: options.maxBytes,
      maxFiles: options.maxFiles,
    });
  }

  write(event: SessionEvent): void {
    const payload = {
      _seq: this.nextSequence++,
      _ts: event.timestamp,
      type: event.type,
      handle: event.handle,
      sessionId: event.sessionId,
      traceId: event.traceId,
      spanId: event.spanId,
      ...event.payload,
    };

    this.writer.append(payload);
  }

  readAll(): SessionEvent[] {
    if (!existsSync(this.filePath)) {
      return [];
    }
    const raw = readFileSync(this.filePath, "utf8");
    const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const events: SessionEvent[] = [];
    let malformed = 0;
    let firstBadLine: string | undefined;
    for (const line of lines) {
      try {
        const record = JSON.parse(line) as SessionEvent & Record<string, unknown>;
        events.push({
          type: String(record.type),
          handle: String(record.handle),
          sessionId: String(record.sessionId ?? record._ts ?? record.timestamp ?? new Date().toISOString()),
          timestamp: String(record._ts ?? record.timestamp ?? new Date().toISOString()),
          traceId: record.traceId as string | undefined,
          spanId: record.spanId as string | undefined,
          payload: (record.payload as Record<string, unknown>) ?? {},
        });
      } catch {
        malformed += 1;
        if (firstBadLine === undefined) {
          firstBadLine = line.slice(0, 200);
        }
      }
    }
    if (malformed > 0) {
      console.error(
        `[session-writer] ${this.filePath}: skipped ${malformed} malformed line(s); first=${JSON.stringify(firstBadLine)}`
      );
    }
    return events;
  }

  readForHandle(handle: string): SessionEvent[] {
    return this.readAll().filter((event) => event.handle === handle);
  }

  clear(): void {
    if (!existsSync(this.filePath)) {
      return;
    }
    writeFileSync(this.filePath, "", "utf8");
    this.nextSequence = 0;
  }
}

// ---------------------------------------------------------------------------
// Replay helper
// ---------------------------------------------------------------------------

export class SessionReplayHelper {
  constructor(private readonly writer: SessionEventWriter) {}

  async replay(handle?: string): Promise<SessionEvent[]> {
    if (handle) {
      return this.writer.readForHandle(handle);
    }
    return this.writer.readAll();
  }

  async replayAsStream(handle?: string): Promise<SessionEvent[]> {
    return this.replay(handle);
  }
}

// ---------------------------------------------------------------------------
// Session store with resume-by-handle
// ---------------------------------------------------------------------------

export interface SessionStoreOptions {
  rootDir?: string;
  recordsFile?: string;
}

export class SessionStore {
  private readonly writer: SessionEventWriter;

  constructor(options: SessionStoreOptions = {}) {
    this.writer = new SessionEventWriter({
      rootDir: options.rootDir,
      eventFile: options.recordsFile ?? "session-handles.jsonl",
    });
  }

  async upsert(handle: AgentHandle): Promise<void> {
    await this.writer.write({
      type: "session_event",
      handle: handle.id,
      sessionId: handle.sessionId ?? handle.id,
      timestamp: new Date().toISOString(),
      traceId: handle.traceId,
      spanId: handle.spanId,
      payload: {
        status: handle.status,
        parentId: handle.parentId,
        returnCode: handle.returnCode,
      },
    });
  }

  async readForHandle(handleId: string): Promise<SessionEvent[]> {
    return this.writer.readForHandle(handleId);
  }

  async readAll(): Promise<SessionEvent[]> {
    return this.writer.readAll();
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

  async emit(
    type: string,
    handle: AgentHandle,
    extraPayload?: Record<string, unknown>
  ): Promise<void> {
    if (!this.writer) return;
    const event: SessionEvent = {
      type,
      handle: handle.id,
      sessionId: handle.sessionId ?? handle.id,
      timestamp: new Date().toISOString(),
      traceId: handle.traceId,
      spanId: handle.spanId,
      payload: {
        status: handle.status,
        parentId: handle.parentId,
        returnCode: handle.returnCode ?? null,
        ...extraPayload,
      },
    };
    await this.writer.write(event);
  }

  async create(handle: AgentHandle): Promise<void> {
    await this.emit("session_created", handle);
  }

  async update(handle: AgentHandle, patch: Record<string, unknown>): Promise<void> {
    await this.emit("session_event", handle, patch);
  }

  async complete(handle: AgentHandle): Promise<void> {
    await this.emit("session_completed", handle, {
      returnCode: handle.returnCode,
    });
  }

  async fail(handle: AgentHandle): Promise<void> {
    await this.emit("session_failed", handle, {
      returnCode: handle.returnCode,
    });
  }

  async cancel(handle: AgentHandle): Promise<void> {
    await this.emit("session_cancelled", handle);
  }
}

export class SessionRuntime {
  private readonly emitter: SessionEventEmitter;

  constructor(options: SessionEventEmitterOptions = {}) {
    this.emitter = new SessionEventEmitter(options);
  }

  createEmitter(): SessionEventEmitter {
    return this.emitter;
  }

  async dispose(): Promise<void> {
    // no-op placeholder for future teardown of writer resources
  }
}
