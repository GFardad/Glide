import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { SessionDurabilityOptions } from "./durability.js";
import { atomicAppendFileSync } from "@glide/core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

export type AgentStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface SessionRecord {
  handle: string;
  sessionId: string;
  campaignId?: string;
  agentId?: string;
  parentHandle?: string;
  status: AgentStatus;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, string>;
}

export interface SessionLogWriterOptions {
  rootDir?: string | undefined;
  eventFile?: string | undefined;
}

export class SessionEventLogWriter {
  private readonly filePath: string;

  constructor(options: SessionLogWriterOptions = {}) {
    const rootDir = options.rootDir ?? ".glide-sessions";
    const eventFile = options.eventFile ?? "session-events.jsonl";
    if (!existsSync(rootDir)) {
      mkdirSync(rootDir, { recursive: true });
    }
    this.filePath = join(rootDir, eventFile);
  }

  write(event: SessionEvent): void {
    atomicAppendFileSync(this.filePath, JSON.stringify(event));
  }

  readAll(): SessionEvent[] {
    if (!existsSync(this.filePath)) {
      return [];
    }
    const raw = readFileSync(this.filePath, "utf8");
    const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const events: SessionEvent[] = [];
    for (const line of lines) {
      try {
        events.push(JSON.parse(line) as SessionEvent);
      } catch {
        // skip malformed lines
      }
    }
    return events;
  }

  readForHandle(handle: string): SessionEvent[] {
    return this.readAll().filter((event) => event.handle === handle);
  }

  clear(): void {
    writeFileSync(this.filePath, "", "utf8");
  }
}

// ---------------------------------------------------------------------------
// Replay helper
// ---------------------------------------------------------------------------

export class SessionReplayHelper {
  constructor(private readonly writer: SessionEventLogWriter) {}

  replay(handle?: string): SessionEvent[] {
    if (handle) {
      return this.writer.readForHandle(handle);
    }
    return this.writer.readAll();
  }

  replayAsStream(handle?: string): SessionEvent[] {
    return this.replay(handle);
  }
}

// ---------------------------------------------------------------------------
// Session store with resume-by-handle
// ---------------------------------------------------------------------------

export interface SessionStoreOptions extends SessionDurabilityOptions {
  recordsFile?: string;
  extension?: string;
}

export class SessionStore {
  private readonly rootDir: string;
  private readonly extension: string;
  private readonly writer: SessionEventLogWriter;

  constructor(options: SessionStoreOptions = {}) {
    this.rootDir = options.rootDir ?? ".glide-sessions";
    this.extension = options.extension ?? ".json";
    this.writer = new SessionEventLogWriter({
      rootDir: this.rootDir,
      eventFile: options.eventFile,
    });

    if (!existsSync(this.rootDir)) {
      mkdirSync(this.rootDir, { recursive: true });
    }
  }

  private recordPath(handle: string): string {
    return join(this.rootDir, `${handle}${this.extension}`);
  }

  create(record: SessionRecord): void {
    this.upsert(record);
    this.writer.write({
      type: "session_created",
      handle: record.handle,
      sessionId: record.sessionId,
      timestamp: record.createdAt,
      payload: {
        agentId: record.agentId,
        campaignId: record.campaignId,
        parentHandle: record.parentHandle,
      },
    });
  }

  load(handle: string): SessionRecord | undefined {
    const path = this.recordPath(handle);
    if (!existsSync(path)) {
      return undefined;
    }
    try {
      return JSON.parse(readFileSync(path, "utf8")) as SessionRecord;
    } catch {
      return undefined;
    }
  }

  update(handle: string, patch: Partial<SessionRecord>): void {
    const existing = this.load(handle);
    if (!existing) {
      return;
    }
    const updated: SessionRecord = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.upsert(updated);
    this.writer.write({
      type: "session_event",
      handle,
      sessionId: updated.sessionId,
      timestamp: updated.updatedAt,
      payload: patch,
    });
  }

  remove(handle: string): void {
    const existing = this.load(handle);
    if (!existing) {
      return;
    }
    this.writer.write({
      type: "session_removed",
      handle,
      sessionId: existing.sessionId,
      timestamp: new Date().toISOString(),
    });
    const path = this.recordPath(handle);
    if (existsSync(path)) {
      try {
        unlinkSync(path);
      } catch {
        // ignore cleanup errors
      }
    }
  }

  resumeByHandle(
    handle: string
  ): { record: SessionRecord; events: SessionEvent[] } | undefined {
    const record = this.load(handle);
    if (!record) {
      return undefined;
    }
    const events = this.writer.readForHandle(handle);
    this.writer.write({
      type: "session_resumed",
      handle,
      sessionId: record.sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        status: record.status,
        eventCount: events.length,
      },
    });
    return { record, events };
  }

  private upsert(record: SessionRecord): void {
    writeFileSync(
      this.recordPath(record.handle),
      JSON.stringify(record, null, 2),
      "utf8"
    );
  }
}
