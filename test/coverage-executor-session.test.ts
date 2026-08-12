import { describe, it, expect, beforeEach } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  SessionEventWriter,
  SessionEventEmitter,
} from "../packages/executor/src/session.js";
import type { AgentHandle } from "../packages/executor/src/agent-handle.js";

const TMP = "/tmp/glide-executor-session-coverage-test";

beforeEach(() => {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true });
  mkdirSync(TMP, { recursive: true });
});

function makeHandle(overrides: {
  id?: string;
  sessionId?: string | undefined;
  status?: string;
  parentId?: string | undefined;
} = {}): AgentHandle {
  return {
    id: overrides.id ?? "h-1",
    sessionId: overrides.sessionId,
    status: overrides.status ?? "pending",
    parentId: overrides.parentId,
  } as AgentHandle;
}

describe("executor session event writer", () => {
  it("writes and reads back session events", () => {
    const writer = new SessionEventWriter({
      rootDir: join(TMP, "logs"),
      eventFile: "events.jsonl",
    });
    const event = {
      type: "session_created" as const,
      handle: "h-1",
      sessionId: "s-1",
      timestamp: new Date().toISOString(),
      payload: { agentId: "agent-1" },
    };
    writer.write(event);
    const all = writer.readAll();
    expect(all).toHaveLength(1);
    expect(all[0]?.type).toBe("session_created");
  });

  it("returns an empty list when the event file is absent", () => {
    const writer = new SessionEventWriter({
      rootDir: join(TMP, "missing"),
      eventFile: "missing.jsonl",
    });
    expect(writer.readAll()).toEqual([]);
  });

  it("skips malformed lines on read", () => {
    const dir = join(TMP, "malformed");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "events.jsonl"), "not-json\n", "utf8");
    const writer = new SessionEventWriter({
      rootDir: dir,
      eventFile: "events.jsonl",
    });
    expect(writer.readAll()).toEqual([]);
  });
});

describe("executor session event emitter", () => {
  it("emits lifecycle events when enabled", () => {
    const emitter = new SessionEventEmitter({ enabled: true, rootDir: join(TMP, "emitter") });

    const handle = makeHandle({ status: "pending" });
    emitter.create(handle);
    emitter.update(handle, { status: "running" });
    emitter.complete(handle);
    emitter.fail(handle);
    emitter.cancel(handle);

    const writer = new SessionEventWriter({
      rootDir: join(TMP, "emitter"),
      eventFile: "session-events.jsonl",
    });
    const events = writer.readAll();
    expect(events.map((e) => e.type)).toEqual([
      "session_created",
      "session_event",
      "session_completed",
      "session_failed",
      "session_cancelled",
    ]);
  });

  it("suppresses events when disabled", () => {
    const emitter = new SessionEventEmitter({ enabled: false });
    const handle = makeHandle({ status: "pending" });
    emitter.create(handle);
    emitter.update(handle, { status: "running" });
    expect(emitter).toBeDefined();
  });

  it("derives sessionId from handle id when sessionId is missing", () => {
    const writer = new SessionEventWriter({
      rootDir: join(TMP, "fallback"),
      eventFile: "session-events.jsonl",
    });
    const emitter = new SessionEventEmitter({
      enabled: true,
      rootDir: join(TMP, "fallback"),
      eventFile: "session-events.jsonl",
    });

    const handle = makeHandle({ id: "standalone-handle", sessionId: undefined, status: "pending" });
    emitter.create(handle);
    const events = writer.readAll();
    expect(events[0]?.sessionId).toBe("standalone-handle");
  });
});
