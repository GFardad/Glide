import { describe, it, expect, beforeEach } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  SessionEventLogWriter,
  SessionReplayHelper,
  SessionStore,
  type SessionEvent,
  type SessionRecord,
} from "../packages/plugin-api/src/session.js";

const TMP = "/tmp/glide-session-coverage-test";

beforeEach(() => {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true });
  mkdirSync(TMP, { recursive: true });
});

function makeRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    handle: "h-1",
    sessionId: "s-1",
    campaignId: "camp-1",
    agentId: "agent-1",
    parentHandle: "h-0",
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: { source: "test" },
    ...overrides,
  };
}

describe("SessionEventLogWriter", () => {
  it("writes and reads back session events", () => {
    const writer = new SessionEventLogWriter({
      rootDir: join(TMP, "logs"),
      eventFile: "events.jsonl",
    });
    const event: SessionEvent = {
      type: "session_created",
      handle: "h-1",
      sessionId: "s-1",
      timestamp: new Date().toISOString(),
      payload: { agentId: "agent-1" },
    };
    writer.write(event);
    const all = writer.readAll();
    expect(all).toHaveLength(1);
    expect(all[0]?.type).toBe("session_created");
    expect(all[0]?.payload?.agentId).toBe("agent-1");
  });

  it("returns an empty list when the event file does not exist", () => {
    const writer = new SessionEventLogWriter({
      rootDir: join(TMP, "missing"),
      eventFile: "missing.jsonl",
    });
    expect(writer.readAll()).toEqual([]);
  });

  it("skips malformed lines on read", () => {
    const dir = join(TMP, "malformed");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "events.jsonl"), "not-json\n", "utf8");
    const writer = new SessionEventLogWriter({
      rootDir: dir,
      eventFile: "events.jsonl",
    });
    expect(writer.readAll()).toEqual([]);
  });

  it("reads events for a specific handle", () => {
    const writer = new SessionEventLogWriter({
      rootDir: join(TMP, "filter"),
      eventFile: "events.jsonl",
    });
    writer.write({
      type: "session_created",
      handle: "h-1",
      sessionId: "s-1",
      timestamp: new Date().toISOString(),
    });
    writer.write({
      type: "session_event",
      handle: "h-1",
      sessionId: "s-1",
      timestamp: new Date().toISOString(),
      payload: { status: "running" },
    });
    writer.write({
      type: "session_created",
      handle: "h-2",
      sessionId: "s-2",
      timestamp: new Date().toISOString(),
    });

    const filtered = writer.readForHandle("h-1");
    expect(filtered).toHaveLength(2);
    expect(filtered[0]?.handle).toBe("h-1");
    expect(filtered[1]?.type).toBe("session_event");
  });

  it("clears the event file", () => {
    const writer = new SessionEventLogWriter({
      rootDir: join(TMP, "clear"),
      eventFile: "events.jsonl",
    });
    writer.write({
      type: "session_created",
      handle: "h-1",
      sessionId: "s-1",
      timestamp: new Date().toISOString(),
    });
    writer.clear();
    expect(writer.readAll()).toEqual([]);
  });
});

describe("SessionReplayHelper", () => {
  it("replays all events and filters by handle", () => {
    const writer = new SessionEventLogWriter({
      rootDir: join(TMP, "replay"),
      eventFile: "events.jsonl",
    });
    const helper = new SessionReplayHelper(writer);
    writer.write({
      type: "session_created",
      handle: "h-1",
      sessionId: "s-1",
      timestamp: new Date().toISOString(),
    });
    writer.write({
      type: "session_event",
      handle: "h-1",
      sessionId: "s-1",
      timestamp: new Date().toISOString(),
      payload: { status: "running" },
    });

    expect(helper.replay()).toHaveLength(2);
    expect(helper.replay("h-1")).toHaveLength(2);
  });
});

describe("SessionStore", () => {
  it("creates, loads, updates, and removes a session record", () => {
    const store = new SessionStore({ rootDir: TMP });

    const record = makeRecord();
    store.create(record);
    const loaded = store.load("h-1");
    expect(loaded?.handle).toBe("h-1");
    expect(loaded?.metadata?.source).toBe("test");

    store.update("h-1", { status: "running" });
    const updated = store.load("h-1");
    expect(updated?.status).toBe("running");

    store.remove("h-1");
    expect(store.load("h-1")).toBeUndefined();
  });

  it("resumes a session by handle with its events", () => {
    const store = new SessionStore({ rootDir: TMP, eventFile: "resume.jsonl" });
    const record = makeRecord({ handle: "h-resume", sessionId: "s-resume" });
    store.create(record);
    store.update("h-resume", { status: "running" });

    const resumed = store.resumeByHandle("h-resume");
    expect(resumed?.record.handle).toBe("h-resume");
    expect(resumed?.events.length).toBeGreaterThanOrEqual(2);
  });

  it("returns undefined when resuming an unknown handle", () => {
    const store = new SessionStore({ rootDir: TMP });
    expect(store.resumeByHandle("missing")).toBeUndefined();
  });
});
