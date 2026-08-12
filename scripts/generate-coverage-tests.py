#!/usr/bin/env python3
"""Generate focused coverage tests for uncovered Glide source files."""
from pathlib import Path

REPO = Path("/media/Storage/home-gfardad/Projects/Glide")
TEST_DIR = REPO / "test"

files = {
    TEST_DIR / "coverage-constitution.test.ts": '''\
import { describe, it, expect } from "vitest";
import {
  loadConstitution,
  writeConstitution,
  proposeAmendment,
  transitionAmendmentStatus,
  validateChangeAgainstConstitution,
} from "../packages/core/src/constitution.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

describe("core/constitution coverage", () => {
  const root = join("/tmp", "glide-constitution-coverage");
  mkdirSync(root, { recursive: true });

  it("loads and writes constitution", () => {
    writeFileSync(
      join(root, "constitution.json"),
      JSON.stringify({
        id: "c1",
        name: "base",
        version: "1.0.0",
        principles: [],
        amendments: [],
        owner: "cto",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      "utf8",
    );
    const c = loadConstitution(root);
    expect(c.id).toBe("c1");
    writeConstitution(root, c);
    expect(loadConstitution(root).id).toBe("c1");
  });

  it("proposes amendment and transitions status", () => {
    const constitution = {
      id: "c2",
      name: "base",
      version: "1.0.0",
      principles: [
        { id: "p1", title: "Keep it local", description: "", immutable: true },
        { id: "p2", title: "Stay fast", description: "", immutable: false },
      ],
      amendments: [],
      owner: "cto",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const amendment = proposeAmendment(constitution, {
      title: "Allow cloud backups",
      description: "Optional cloud snapshots for remote safety.",
      targetPrincipleIds: ["p2"],
      proposedChanges: ["Stay fast unless explicitly opting in."],
      proposedBy: "cto",
    });
    expect(amendment.status).toBe("proposed");
    const reviewed = transitionAmendmentStatus(amendment, "review", {
      reviewNotes: "Looks safe.",
    });
    expect(reviewed.status).toBe("review");
    const ratified = transitionAmendmentStatus(reviewed, "ratified", {
      backwardsCompatibility: { compatible: true, breakingChanges: [] },
    });
    expect(ratified.status).toBe("ratified");
  });

  it("rejects invalid transitions and immutable violations", () => {
    const constitution = {
      id: "c3",
      name: "base",
      version: "1.0.0",
      principles: [
        { id: "p1", title: "No telemetry", description: "", immutable: true },
      ],
      amendments: [],
      owner: "cto",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const amendment = proposeAmendment(constitution, {
      title: "Send logs",
      description: "Outbound telemetry.",
      targetPrincipleIds: ["p1"],
      proposedChanges: ["Send logs"],
      proposedBy: "cto",
    });
    expect(() => transitionAmendmentStatus(amendment, "ratified")).toThrow();
    expect(() =>
      validateChangeAgainstConstitution(constitution, [
        { principleId: "p1", replacement: "Send logs" },
      ])
    ).toThrow(/Unknown principle|immutable principle/);
  });
});
''',

    TEST_DIR / "coverage-headroom-runtime.test.ts": '''\
import { describe, it, expect, beforeEach } from "vitest";
import { HeadroomRuntime } from "../packages/headroom/src/runtime.js";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

describe("headroom/runtime coverage", () => {
  const roots: string[] = [];

  function makeRoot(name: string): string {
    const root = join("/tmp", `glide-${name}`);
    if (existsSync(root)) rmSync(root, { recursive: true, force: true });
    mkdirSync(root, { recursive: true });
    roots.push(root);
    return root;
  }

  beforeEach(() => {
    for (const root of roots) {
      if (existsSync(root)) rmSync(root, { recursive: true, force: true });
    }
    roots.length = 0;
  });

  it("initializes runtime and applies delta", async () => {
    const root = makeRoot("runtime-init");
    const runtime = new HeadroomRuntime(root);
    const state = await runtime.initialize("ship a feature");
    expect(state.campaign.goal).toBe("ship a feature");
    const snapshot = runtime.applyDelta({
      operations: [
        { kind: "add", goalId: "g1", goal: "write tests", campaignId: state.campaign.id },
      ],
    });
    expect(snapshot.state).toHaveLength(2);
  });

  it("rolls back to snapshot", async () => {
    const root = makeRoot("runtime-rollback");
    const runtime = new HeadroomRuntime(root);
    const state = await runtime.initialize("ship a feature");
    const first = runtime.applyDelta({
      operations: [
        { kind: "add", goalId: "g1", campaignId: state.campaign.id },
      ],
    });
    const second = runtime.applyDelta({
      operations: [
        { kind: "add", goalId: "g2", campaignId: state.campaign.id },
      ],
    });
    expect(first.state).toHaveLength(2);
    expect(second.state).toHaveLength(3);
    const rolled = runtime.rollback(first.id);
    expect(rolled.state).toHaveLength(2);
  });

  it("loads latest snapshot", async () => {
    const root = makeRoot("runtime-latest");
    const runtime = new HeadroomRuntime(root);
    const state = await runtime.initialize("ship a feature");
    const snap = runtime.applyDelta({
      operations: [
        { kind: "add", goalId: "g1", campaignId: state.campaign.id },
      ],
    });
    const latest = runtime.loadLatestSnapshot();
    expect(latest?.id).toBe(snap.id);
  });

  it("throws on missing constitution root", async () => {
    const root = makeRoot("runtime-missing");
    const runtime = new HeadroomRuntime(root);
    await expect(runtime.initialize("missing campaign root")).rejects.toThrow();
  });
});
''',

    TEST_DIR / "coverage-headroom-heartbeat.test.ts": '''\
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  startHeartbeat,
  runScheduledGoals,
  loadHeartbeatState,
  persistHeartbeatState,
} from "../packages/headroom/src/heartbeat.js";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

describe("headroom/heartbeat coverage", () => {
  const roots: string[] = [];

  function makeRoot(name: string): string {
    const root = join("/tmp", `glide-heartbeat-${name}`);
    if (existsSync(root)) rmSync(root, { recursive: true, force: true });
    mkdirSync(root, { recursive: true });
    roots.push(root);
    return root;
  }

  beforeEach(() => {
    for (const root of roots) {
      if (existsSync(root)) rmSync(root, { recursive: true, force: true });
    }
    roots.length = 0;
  });

  afterEach(() => {
    for (const root of roots) {
      if (existsSync(root)) rmSync(root, { recursive: true, force: true });
    }
  });

  it("runs heartbeat ticks and persists state", async () => {
    const root = makeRoot("ticks");
    const tick = vi.fn().mockResolvedValue(undefined);
    const stop = startHeartbeat({ root, intervalMs: 10, maxIterations: 2, onTick: tick });
    await new Promise((resolve) => setTimeout(resolve, 60));
    stop();
    expect(tick).toHaveBeenCalledTimes(2);
    const state = loadHeartbeatState(root);
    expect(state?.iteration).toBe(2);
  });

  it("runs scheduled goals and updates metadata", () => {
    const root = makeRoot("scheduled");
    runScheduledGoals({
      root,
      expression: "PT1M",
      onSchedule: vi.fn(),
    });
    const state = loadHeartbeatState(root);
    expect(state?.activeGoals).toEqual([]);
  });

  it("persists and reads heartbeat state", () => {
    const root = makeRoot("state");
    persistHeartbeatState(root, { iteration: 5, activeGoals: ["g1"], lastTickAt: new Date().toISOString() });
    const state = loadHeartbeatState(root);
    expect(state?.iteration).toBe(5);
    expect(state?.activeGoals).toEqual(["g1"]);
  });

  it("loadHeartbeatState returns undefined when missing", () => {
    const root = makeRoot("missing-state");
    expect(loadHeartbeatState(root)).toBeUndefined();
  });
});
''',

    TEST_DIR / "coverage-mcp-server.test.ts": '''\
import { describe, it, expect } from "vitest";
import { createGlideServer, main } from "../packages/mcp-server/src/server.js";

describe("mcp-server coverage", () => {
  it("creates glide server", () => {
    const server = createGlideServer();
    expect(server).toBeDefined();
  });

  it("server does not throw on list tools", async () => {
    const server = createGlideServer();
    let result: unknown = null;
    await server.setRequestHandler({ method: "tools/list" } as any, async () => {
      result = true;
      return { tools: [] };
    });
    expect(result).toBe(true);
  });

  it("main is defined", () => {
    expect(typeof main).toBe("function");
  });
});
''',

    TEST_DIR / "coverage-bridge.test.ts": '''\
import { describe, it, expect } from "vitest";
import { HostBridge } from "../packages/mcp-server/src/bridge/HostBridge.js";

describe("mcp-server/bridge coverage", () => {
  it("handles valid host request", async () => {
    const bridge = new HostBridge();
    bridge.on({
      method: "echo",
      handler: async (req) => ({ ok: true, id: req.id }),
    });
    const response = JSON.parse(await bridge.handle('{"jsonrpc":"2.0","id":1,"method":"echo"}'));
    expect(response.result.ok).toBe(true);
  });

  it("returns parse error for invalid JSON", async () => {
    const bridge = new HostBridge();
    const response = JSON.parse(await bridge.handle("not-json"));
    expect(response.error.code).toBe("PARSE_ERROR");
  });

  it("returns method not found when no route registered", async () => {
    const bridge = new HostBridge();
    const response = JSON.parse(await bridge.handle('{"jsonrpc":"2.0","id":1,"method":"missing"}'));
    expect(response.error.code).toBe("METHOD_NOT_FOUND");
  });

  it("returns invalid request for non-object envelope", async () => {
    const bridge = new HostBridge();
    const response = JSON.parse(await bridge.handle("[1,2]"));
    expect(response.error.code).toBe("INVALID_REQUEST");
  });

  it("returns internal error when handler throws", async () => {
    const bridge = new HostBridge();
    bridge.on({
      method: "fail",
      handler: async () => {
        throw new Error("boom");
      },
    });
    const response = JSON.parse(await bridge.handle('{"jsonrpc":"2.0","id":1,"method":"fail"}'));
    expect(response.error.code).toBe("INTERNAL_ERROR");
  });
});
''',

    TEST_DIR / "coverage-mcp-graphify.test.ts": '''\
import { describe, it, expect, vi, beforeEach } from "vitest";
import { glideGraphTool } from "../packages/mcp-server/src/tools/glide-graph.js";

describe("mcp-server/tools/glide_graph coverage", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns validation error for missing action or project_path", async () => {
    const result = await glideGraphTool.handler({});
    const text = result.content[0]?.text;
    const payload = JSON.parse(text);
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe("action and project_path are required");
  });

  it("wraps graphify errors into tool result", async () => {
    vi.doMock("@glide/tracer", () => ({
      GraphifyClient: class {
        constructor() {
          this.read = () => {
            throw new Error("graph missing");
          };
        }
        query() { return { nodes: [], edges: [] }; }
        shortestPath() { return null; }
        community() { return []; }
        nodeDetails() { return null; }
        prImpact() { return { pr_number: 1, files: [], communities: [], community_names: [], nodes_touched: 0 }; }
      },
    }));
    const { glideGraphTool: tool } = await import("../packages/mcp-server/src/tools/glide-graph.js");
    const result = await tool.handler({ action: "query", project_path: "/tmp/nope" });
    const payload = JSON.parse(result.content[0]?.text);
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe("graph missing");
  });
});
''',

    TEST_DIR / "coverage-mcp-converge.test.ts": '''\
import { describe, it, expect } from "vitest";
import { glideConvergeTool } from "../packages/mcp-server/src/tools/glide-converge.js";

describe("mcp-server/tools/glide_converge coverage", () => {
  it("returns validation error for missing campaign_dir", async () => {
    const result = await glideConvergeTool.handler({});
    const payload = JSON.parse(result.content[0]?.text);
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe("campaign_dir is required");
  });

  it("runs converge assessment with default dirs", async () => {
    const result = await glideConvergeTool.handler({
      campaign_dir: "/tmp/glide-campaign",
      write_report: false,
    });
    const payload = JSON.parse(result.content[0]?.text);
    expect(payload.tool).toBe("glide_converge");
    expect(payload.report).toBeDefined();
  });
});
''',

    TEST_DIR / "coverage-mcp-gates.test.ts": '''\
import { describe, it, expect } from "vitest";
import { glideGatesTool } from "../packages/mcp-server/src/tools/glide-gates.js";

describe("mcp-server/tools/glide_gates coverage", () => {
  it("returns validation error for missing workspace", async () => {
    const result = await glideGatesTool.handler({});
    const payload = JSON.parse(result.content[0]?.text);
    expect(payload.tool).toBe("glide_gates");
    expect(payload.error).toBe("workspace is required");
  });

  it("runs default gates", async () => {
    const result = await glideGatesTool.handler({ workspace: "/tmp/glide-workspace" });
    const payload = JSON.parse(result.content[0]?.text);
    expect(payload.tool).toBe("glide_gates");
    expect("passed" in payload).toBe(true);
  });

  it("runs selected gates", async () => {
    const result = await glideGatesTool.handler({
      workspace: "/tmp/glide-workspace",
      gates: ["build"],
    });
    const payload = JSON.parse(result.content[0]?.text);
    expect(payload.tool).toBe("glide_gates");
  });
});
''',

    TEST_DIR / "coverage-mcp-types.test.ts": '''\
import { describe, it, expect } from "vitest";
import type { GlideTool, GlideToolHandler } from "../packages/mcp-server/src/tools/types.js";

describe("mcp-server/tools/types coverage", () => {
  it("allows a synchronous tool handler", () => {
    const handler: GlideToolHandler = () => ({
      content: [{ type: "text", text: "ok" }],
    });
    const tool: GlideTool = {
      name: "example",
      description: "example",
      inputSchema: { type: "object", properties: {} },
      handler,
    };
    expect(tool.name).toBe("example");
    expect(tool.handler()).toEqual({ content: [{ type: "text", text: "ok" }] });
  });

  it("allows an async tool handler", async () => {
    const handler: GlideToolHandler = async () => ({
      content: [{ type: "text", text: "async" }],
    });
    const tool: GlideTool = {
      name: "async_example",
      description: "example",
      inputSchema: { type: "object", properties: {} },
      handler,
    };
    expect(await tool.handler()).toEqual({ content: [{ type: "text", text: "async" }] });
  });
});
''',

    TEST_DIR / "coverage-composition.test.ts": '''\
import { describe, it, expect } from "vitest";
import {
  CompositionRegistry,
  CompositionError,
  PluginDescriptor,
  PluginInstance,
} from "../packages/plugin-api/src/composition.js";

describe("plugin-api/composition coverage", () => {
  const registry = new CompositionRegistry();
  const plugin = (id: string): PluginInstance => ({
    descriptor: {
      id,
      name: id,
      version: "0.1.0",
      kind: "mcp",
      entrypoint: { module: "./mod.js", exportName: "plugin" },
    },
    loadedAt: new Date(),
  });

  it("registers and lists composition parts", () => {
    registry.registerExtensionPoint({ id: "ep1", name: "hooks" });
    registry.registerPreset({ id: "preset1", name: "default" });
    registry.registerBundle({
      id: "bundle1",
      name: "defaults",
      roles: { engineer: [{ id: "engineer", kind: "mcp" }] },
    });
    expect(registry.listExtensionPoints()).toHaveLength(1);
    expect(registry.listPresets()).toHaveLength(1);
    expect(registry.listBundles()).toHaveLength(1);
  });

  it("composes bundle with parent inheritance", () => {
    const registry = new CompositionRegistry();
    registry.registerBundle({
      id: "parent",
      name: "parent",
      roles: { reviewer: [{ id: "reviewer", kind: "mcp" }] },
      presets: ["base"],
      defaults: { timeoutMs: 1000 },
    });
    registry.registerBundle({
      id: "child",
      name: "child",
      extends: ["parent"],
      roles: { engineer: [{ id: "engineer", kind: "mcp", overrides: { name: "eng" } }] },
    });
    registry.registerPreset({ id: "base", name: "base" });
    const composed = registry.composeBundle("child", {
      load: (id) => plugin(id),
      has: (id) => ["engineer", "reviewer"].includes(id),
    });
    expect(composed).toHaveLength(2);
    expect(composed.find((p) => p.role === "engineer")?.descriptor.name).toBe("eng");
    expect(composed.find((p) => p.role === "reviewer")?.descriptor.name).toBe("reviewer");
  });

  it("throws when bundle or parent missing", () => {
    const registry = new CompositionRegistry();
    expect(() => registry.composeBundle("missing", { load: plugin, has: () => false })).toThrow("NOT_FOUND");
    registry.registerBundle({ id: "b1", name: "b1", extends: ["missing-parent"] });
    expect(() => registry.composeBundle("b1", { load: plugin, has: () => false })).toThrow("NOT_FOUND");
  });
});
''',

    TEST_DIR / "coverage-session.test.ts": '''\
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  SessionEventLogWriter,
  SessionReplayHelper,
  SessionStore,
} from "../packages/plugin-api/src/session.js";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

describe("plugin-api/session coverage", () => {
  const roots: string[] = [];

  function makeRoot(name: string): string {
    const root = join("/tmp", `glide-session-${name}`);
    if (existsSync(root)) rmSync(root, { recursive: true, force: true });
    mkdirSync(root, { recursive: true });
    roots.push(root);
    return root;
  }

  beforeEach(() => {
    for (const root of roots) {
      if (existsSync(root)) rmSync(root, { recursive: true, force: true });
    }
    roots.length = 0;
  });

  afterEach(() => {
    for (const root of roots) {
      if (existsSync(root)) rmSync(root, { recursive: true, force: true });
    }
  });

  it("writes and replays session events", () => {
    const root = makeRoot("events");
    const writer = new SessionEventLogWriter({ rootDir: root, eventFile: "events.jsonl" });
    writer.write({
      type: "session_created",
      handle: "h1",
      sessionId: "s1",
      timestamp: new Date().toISOString(),
      payload: { status: "running" },
    });
    const events = writer.readAll();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("session_created");

    const helper = new SessionReplayHelper(writer);
    expect(helper.replay("h1")).toHaveLength(1);
    expect(helper.replayAsStream()).toHaveLength(1);
  });

  it("creates, loads, updates, resumes, and removes session records", () => {
    const root = makeRoot("store");
    const store = new SessionStore({ rootDir: root, recordsFile: "records.json", eventFile: "events.jsonl" });
    store.create({
      handle: "h1",
      sessionId: "s1",
      status: "running",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: { campaignId: "c1" },
    });
    const loaded = store.load("h1");
    expect(loaded?.sessionId).toBe("s1");
    expect(loaded?.metadata?.campaignId).toBe("c1");

    store.update("h1", { status: "completed" });
    expect(store.load("h1")?.status).toBe("completed");

    const resumed = store.resumeByHandle("h1");
    expect(resumed?.record.status).toBe("completed");
    expect(resumed?.events.length).toBeGreaterThanOrEqual(1);

    store.remove("h1");
    expect(store.load("h1")).toBeUndefined();
  });

  it("returns undefined for missing handle", () => {
    const store = new SessionStore({ rootDir: "/tmp/glide-session-missing" });
    expect(store.load("missing")).toBeUndefined();
    expect(store.resumeByHandle("missing")).toBeUndefined();
  });
});
''',

    TEST_DIR / "coverage-goal-store.test.ts": '''\
import { describe, it, expect, beforeEach } from "vitest";
import {
  createGoalRecord,
  persistGoal,
  loadGoal,
  loadGoalsByCampaign,
  updateGoalStatus,
  loadActiveGoals,
  loadAllGoals,
  writeGoalSnapshot,
  readGoalSnapshot,
} from "../packages/headroom/src/goal-store.js";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("headroom/goal-store coverage", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "glide-goal-store-"));
  });

  it("persists and loads goal records", () => {
    const record = createGoalRecord("ship feature", { campaignId: "c1" });
    persistGoal({ root }, record);
    const loaded = loadGoal({ root }, record.id);
    expect(loaded?.goal).toBe("ship feature");
    expect(loaded?.campaignId).toBe("c1");
  });

  it("loads goals by campaign and status", () => {
    const a = createGoalRecord("a", { campaignId: "c1", status: "active" });
    const b = createGoalRecord("b", { campaignId: "c1", status: "scheduled" });
    persistGoal({ root }, a);
    persistGoal({ root }, b);
    expect(loadGoalsByCampaign({ root }, "c1")).toHaveLength(2);
    expect(loadActiveGoals({ root })).toHaveLength(1);
    updateGoalStatus({ root }, a.id, "completed");
    expect(loadActiveGoals({ root })).toHaveLength(0);
  });

  it("loads all goals and round-trips snapshot", () => {
    persistGoal({ root }, createGoalRecord("one"));
    persistGoal({ root }, createGoalRecord("two"));
    expect(loadAllGoals({ root })).toHaveLength(2);
    writeGoalSnapshot({ root }, loadAllGoals({ root })!);
    const snapshot = readGoalSnapshot({ root });
    expect(snapshot).toHaveLength(2);
  });
});
''',

    TEST_DIR / "coverage-mcp-tools.test.ts": '''\
import { describe, it, expect } from "vitest";
import { tools } from "../packages/mcp-server/src/tools/index.js";

describe("mcp-server/tools registration coverage", () => {
  it("registers all declared glide tools", () => {
    const names = tools.map((tool) => tool.name);
    expect(names).toContain("glide_status");
    expect(names).toContain("glide_goal_set");
    expect(names).toContain("glide_goal_get");
    expect(names).toContain("glide_headroom");
    expect(names).toContain("glide_plan");
    expect(names).toContain("glide_build");
    expect(names).toContain("glide_test");
    expect(names).toContain("glide_review");
    expect(names).toContain("glide_ship");
    expect(names).toContain("glide_converge");
    expect(names).toContain("glide_gates");
    expect(names).toContain("glide_permissions");
    expect(names).toContain("glide_indepth");
    expect(names).toContain("glide_trace");
    expect(names).toContain("glide_tracer");
    expect(names).toContain("glide_graph");
  });
});
''',
}

for path, content in files.items():
    path.write_text(content, encoding="utf-8")
print(f"wrote {len(files)} coverage test files")
