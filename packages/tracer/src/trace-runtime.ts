import type { JsonlRecord } from "./jsonl-writer.js";
import { JsonlWriter } from "./jsonl-writer.js";

export interface TraceEvent extends JsonlRecord {
  agentId: string;
  action: string;
  status: string;
  detail?: string;
  traceId?: string;
  spanId?: string;
  sessionId?: string;
}

export interface TraceRuntimeOptions {
  rootDir?: string;
  fileName?: string;
  maxBytes?: number;
  maxFiles?: number;
}

export class TraceRuntime {
  private readonly writer: JsonlWriter;

  constructor(options: TraceRuntimeOptions = {}) {
    this.writer = new JsonlWriter({
      rootDir: options.rootDir ?? ".glide-sessions",
      fileName: options.fileName ?? "trace-events.jsonl",
      maxBytes: options.maxBytes,
      maxFiles: options.maxFiles,
    });
  }

  async log(
    event: Omit<TraceEvent, "_seq" | "_ts">,
    correlation?: { traceId?: string; spanId?: string; sessionId?: string }
  ): Promise<void> {
    const payload: JsonlRecord = {
      _ts: new Date().toISOString(),
      traceId: correlation?.traceId ?? event.traceId,
      spanId: correlation?.spanId ?? event.spanId,
      sessionId: correlation?.sessionId ?? event.sessionId,
      ...event,
    };
    await this.writer.append(payload);
  }

  async readAll(): Promise<TraceEvent[]> {
    return this.writer.readAll<TraceEvent>();
  }

  async clear(): Promise<void> {
    await this.writer.clear();
  }
}
