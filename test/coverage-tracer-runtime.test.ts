import { describe, it, expect, beforeEach } from "vitest";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { traceAgent, indepthAgent } from "../packages/tracer/src/tracer.js";

/**
 * Coverage gap tests for the tracer runtime (packages/tracer/src/tracer.ts).
 * The existing test/tracer.test.ts exercises the compiled dist build; these
 * tests hit the src tree directly so v8 coverage sees them.
 */
describe("tracer runtime (src coverage)", () => {
  const tmpRoot = "/tmp/glide-tracer-src-test";

  beforeEach(() => {
    if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true });
    mkdirSync(tmpRoot, { recursive: true });
  });

  function writeAgent(
    workspace: string,
    agentId: string,
    opts: {
      goal?: string;
      personality?: string;
      notes?: string;
      todos?: string;
    } = {}
  ) {
    const dir = join(workspace, "agents", agentId);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "GOAL.md"),
      opts.goal ?? `# Goal\n\nGoal of ${agentId}\n`
    );
    writeFileSync(
      join(dir, "PERSONALITY.md"),
      opts.personality ?? `# Personality\n\nParent: none\n`
    );
    writeFileSync(join(dir, "NOTES.md"), opts.notes ?? "");
    writeFileSync(join(dir, "TODO.md"), opts.todos ?? "");
  }

  it("throws when the agent directory does not exist", () => {
    expect(() =>
      traceAgent({ workspace: join(tmpRoot, "ws-empty"), agentId: "ghost" })
    ).toThrow("Agent not found: ghost");
  });

  it("throws when GOAL.md is missing", () => {
    const ws = join(tmpRoot, "ws-nogoal");
    const dir = join(ws, "agents", "x");
    mkdirSync(dir, { recursive: true });
    expect(() => traceAgent({ workspace: ws, agentId: "x" })).toThrow(
      "Agent not found: x"
    );
  });

  it("returns empty notes/todos when files are absent and parent defaults to none", () => {
    const ws = join(tmpRoot, "ws-sparse");
    const dir = join(ws, "agents", "a");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "GOAL.md"), "# Goal\n\nSparse\n");
    writeFileSync(join(dir, "PERSONALITY.md"), "# Personality\n");

    const trace = traceAgent({ workspace: ws, agentId: "a", depth: 1 });
    expect(trace.goal).toContain("Sparse");
    expect(trace.notes).toEqual([]);
    expect(trace.todos).toEqual([]);
    expect(trace.parentId).toBe("none");
    expect(trace.children).toEqual([]);
    expect(trace.depth).toBe(1);
  });

  it("reads parent from PERSONALITY.md and skips child scan at depth 1", () => {
    const ws = join(tmpRoot, "ws-parent");
    writeAgent(ws, "child", { personality: "# Personality\n\nParent: root\n" });
    writeAgent(ws, "root");

    const trace = traceAgent({ workspace: ws, agentId: "child", depth: 1 });
    expect(trace.parentId).toBe("root");
    expect(trace.children).toEqual([]);
  });

  it("finds children that point back to the agent", () => {
    const ws = join(tmpRoot, "ws-children");
    writeAgent(ws, "root");
    writeAgent(ws, "kid1", { personality: "# Personality\n\nParent: root\n" });
    writeAgent(ws, "kid2", { personality: "# Personality\n\nParent: root\n" });
    writeAgent(ws, "orphan", {
      personality: "# Personality\n\nParent: other\n",
    });

    const trace = traceAgent({ workspace: ws, agentId: "root", depth: 3 });
    expect(trace.children.sort()).toEqual(["kid1", "kid2"]);
  });

  it("indepth renders '(none)' placeholders when notes/todos are missing", () => {
    const ws = join(tmpRoot, "ws-indepth-sparse");
    const dir = join(ws, "agents", "n");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "GOAL.md"), "# Goal\n\nBare\n");
    writeFileSync(join(dir, "PERSONALITY.md"), "# Personality\n");

    const md = indepthAgent({ workspace: ws, agentId: "n" });
    expect(md).toContain("# Agent: n");
    expect(md).toContain("## Goal");
    expect(md).toContain("Bare");
    expect(md).toContain("## Parent");
    expect(md).toContain("none");
    expect(md).toContain("## Children");
    expect(md).toContain("## Notes");
    expect(md).toContain("(none)");
    expect(md).toContain("## Todos");
  });

  it("indepth lists children when present", () => {
    const ws = join(tmpRoot, "ws-indepth-children");
    writeAgent(ws, "root");
    writeAgent(ws, "kid", { personality: "# Personality\n\nParent: root\n" });

    const md = indepthAgent({ workspace: ws, agentId: "root" });
    expect(md).toContain("## Children");
    expect(md).toContain("kid");
  });

  it("trims and filters blank lines from notes", () => {
    const ws = join(tmpRoot, "ws-notes");
    writeAgent(ws, "a", { notes: "\n  note one  \n\nnote two\n\n" });
    const trace = traceAgent({ workspace: ws, agentId: "a" });
    expect(trace.notes).toEqual(["note one", "note two"]);
  });
});
