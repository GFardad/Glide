import { describe, it, expect, beforeEach } from "vitest";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { traceAgent, indepthAgent } from "../packages/tracer/dist/tracer.js";

describe("tracer runtime", () => {
  const tmpRoot = "/tmp/glide-tracer-test";

  beforeEach(() => {
    if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true });
    mkdirSync(tmpRoot, { recursive: true });
  });

  it("traces agent from files", () => {
    const workspace = join(tmpRoot, "ws1");
    const agentId = "agent-1";
    const agentDir = join(workspace, "agents", agentId);
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(join(agentDir, "GOAL.md"), "# Goal\n\nBuild runtime\n");
    writeFileSync(
      join(agentDir, "PERSONALITY.md"),
      "# Personality\n\nParent: none\n"
    );
    writeFileSync(join(agentDir, "NOTES.md"), "- note 1\n- note 2\n");
    writeFileSync(join(agentDir, "TODO.md"), "- task 1\n");

    const trace = traceAgent({ workspace, agentId });
    expect(trace.agentId).toBe(agentId);
    expect(trace.goal).toContain("Build runtime");
    expect(trace.notes).toEqual(["- note 1", "- note 2"]);
    expect(trace.todos).toEqual(["- task 1"]);
    expect(trace.parentId).toBe("none");
    expect(trace.children).toEqual([]);
  });

  it("returns indepth markdown", () => {
    const workspace = join(tmpRoot, "ws2");
    const agentId = "agent-2";
    const agentDir = join(workspace, "agents", agentId);
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(join(agentDir, "GOAL.md"), "# Goal\n\nTrace test\n");
    writeFileSync(
      join(agentDir, "PERSONALITY.md"),
      "# Personality\n\nParent: parent-1\n"
    );
    writeFileSync(join(agentDir, "NOTES.md"), "- note\n");
    writeFileSync(join(agentDir, "TODO.md"), "- todo\n");

    const md = indepthAgent({ workspace, agentId });
    expect(md).toContain("# Agent: agent-2");
    expect(md).toContain("## Goal");
    expect(md).toContain("Trace test");
    expect(md).toContain("## Parent");
    expect(md).toContain("parent-1");
    expect(md).toContain("## Notes");
    expect(md).toContain("note");
    expect(md).toContain("## Todos");
    expect(md).toContain("todo");
  });

  it("detects children by parent link", () => {
    const workspace = join(tmpRoot, "ws3");
    const parentDir = join(workspace, "agents", "parent");
    const childDir = join(workspace, "agents", "child");
    mkdirSync(parentDir, { recursive: true });
    mkdirSync(childDir, { recursive: true });
    writeFileSync(join(parentDir, "GOAL.md"), "# Goal\n\nParent goal\n");
    writeFileSync(
      join(parentDir, "PERSONALITY.md"),
      "# Personality\n\nParent: none\n"
    );
    writeFileSync(join(parentDir, "NOTES.md"), "");
    writeFileSync(join(parentDir, "TODO.md"), "");
    writeFileSync(join(childDir, "GOAL.md"), "# Goal\n\nChild goal\n");
    writeFileSync(
      join(childDir, "PERSONALITY.md"),
      "# Personality\n\nParent: parent\n"
    );
    writeFileSync(join(childDir, "NOTES.md"), "");
    writeFileSync(join(childDir, "TODO.md"), "");

    const trace = traceAgent({ workspace, agentId: "parent" });
    expect(trace.children).toEqual(["child"]);
  });
});
