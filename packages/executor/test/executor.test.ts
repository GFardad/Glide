import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AgentStatus } from "../src/agent-status.js";
import type { AgentHandle } from "../src/agent-handle.js";
import { ExecutorRuntime, createIpcPath, removeIpcPath } from "../src/executor.js";

describe("AgentStatus", () => {
  it("exposes all lifecycle states", () => {
    expect(AgentStatus.Pending).toBe("pending");
    expect(AgentStatus.Running).toBe("running");
    expect(AgentStatus.Completed).toBe("completed");
    expect(AgentStatus.Failed).toBe("failed");
    expect(AgentStatus.Cancelled).toBe("cancelled");
  });
});

describe("ExecutorRuntime", () => {
  const baseCmd = "node";
  const runtime = new ExecutorRuntime();

  it("returns a typed AgentHandle with expected fields", async () => {
    const handle = runtime.spawnAgent({
      command: baseCmd,
      args: ["-e", "console.log(JSON.stringify({role:'assistant',content:'hi',timestamp:new Date().toISOString()})); process.exit(0)"],
    });

    expect<AgentHandle>(handle);
    expect(handle.id).toBeTruthy();
    expect(handle.status).toBe(AgentStatus.Pending);
    expect(handle.createdAt).toBeTruthy();
    expect(handle.messages).toEqual([]);
    expect(handle.parentId).toBeUndefined();
    expect(handle.ipcPath).toBeUndefined();
    expect(handle.traceId).toBeTruthy();
    expect(handle.spanId).toBeTruthy();
  });

  it("transitions to Completed and parses JSONL stdout messages", async () => {
    const handle = runtime.spawnAgent({
      command: baseCmd,
      args: [
        "-e",
        `const msg = {role:'assistant',content:'hello',timestamp:new Date().toISOString()}; console.log(JSON.stringify(msg)); process.exit(0);`,
      ],
    });

    const result = await runtime.awaitAgent(handle);
    expect(result.handle.status).toBe(AgentStatus.Completed);
    expect(result.exitCode).toBe(0);
    expect(result.handle.messages.length).toBeGreaterThanOrEqual(1);
    expect(result.handle.messages[0]!.role).toBe("assistant");
    expect(result.handle.messages[0]!.content).toBe("hello");
  });

  it("marks non-zero exit as Failed and captures stderr as error message", async () => {
    const handle = runtime.spawnAgent({
      command: baseCmd,
      args: ["-e", "console.error('boom'); process.exit(42);"],
    });

    const result = await runtime.awaitAgent(handle);
    expect(result.handle.status).toBe(AgentStatus.Failed);
    expect(result.exitCode).toBe(42);
    const errorMsg = result.handle.messages.find((m) => m.role === "error");
    expect(errorMsg).toBeTruthy();
  });

  it("handles spawn errors gracefully", async () => {
    const handle = runtime.spawnAgent({
      command: "non-existent-binary-xyz",
      args: [],
    });

    const result = await runtime.awaitAgent(handle);
    expect(result.handle.status).toBe(AgentStatus.Failed);
    const errorMsg = result.handle.messages.find((m) => m.role === "error");
    expect(errorMsg).toBeTruthy();
  });

  it("supports parentId and ipcPath metadata", async () => {
    const handle = runtime.spawnAgent({
      command: baseCmd,
      args: ["-e", "process.exit(0);"],
      parentId: "parent-1",
      ipcPath: "/tmp/test.ipc",
    });

    expect(handle.parentId).toBe("parent-1");
    expect(handle.ipcPath).toBe("/tmp/test.ipc");
  });

  it("kills a running agent and marks it Cancelled", async () => {
    const handle = runtime.spawnAgent({
      command: "node",
      args: ["-e", "setTimeout(()=>{}, 10000);"],
    });

    await new Promise((r) => setTimeout(r, 100));
    expect(handle.status).toBe(AgentStatus.Running);

    runtime.cancelAgent(handle);

    const result = await runtime.awaitAgent(handle);
    expect(result.handle.status).toBe(AgentStatus.Cancelled);
  });
});

describe("createIpcPath / removeIpcPath", () => {
  const baseDir = tmpdir();

  it("creates and removes an IPC file", async () => {
    const id = "test-handle";
    const path = createIpcPath(baseDir, id);
    expect(path).toBe(join(baseDir, `glide-agent-${id}.ipc`));

    removeIpcPath(path);
    removeIpcPath(path);
  });
});
