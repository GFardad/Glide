import { describe, it, expect, beforeEach } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  spawnAgent,
  cancelAgent,
  awaitAgent,
  createIpcPath,
  removeIpcPath,
} from "../packages/executor/src/executor.js";
import type { AgentHandle } from "../packages/executor/src/agent-handle.js";

const TMP = "/tmp/glide-executor-coverage-test";

describe("executor coverage gaps", () => {
  beforeEach(() => {
    if (existsSync(TMP)) rmSync(TMP, { recursive: true });
    mkdirSync(TMP, { recursive: true });
  });

  it("spawns an agent and observes completion", async () => {
    const script = join(TMP, "echo-agent.js");
    writeFileSync(
      script,
      `
      process.stdout.write(JSON.stringify({ role: "assistant", content: "done", timestamp: new Date().toISOString() }) + "\\n");
      setTimeout(() => process.exit(0), 50);
      `
    );

    const handle = spawnAgent({
      command: "node",
      args: [script],
      cwd: TMP,
    });

    expect(handle.status).toBe("pending");
    const result = await awaitAgent(handle);
    expect(result.exitCode).toBe(0);
    expect(result.error).toBeUndefined();
    expect(result.handle.status).toBe("completed");
    expect(result.handle.messages.some((m) => m.content === "done")).toBe(true);
  });

  it("captures stderr as error message on failure", async () => {
    const script = join(TMP, "fail-agent.js");
    writeFileSync(
      script,
      `
      process.stderr.write("boom\\n");
      setTimeout(() => process.exit(1), 50);
      `
    );

    const handle = spawnAgent({
      command: "node",
      args: [script],
      cwd: TMP,
    });

    const result = await awaitAgent(handle);
    expect(result.exitCode).toBe(1);
    expect(result.error).toBeInstanceOf(Error);
    expect(result.handle.status).toBe("failed");
    expect(result.handle.messages.some((m) => m.role === "error")).toBe(true);
  });

  it("returns an already-completed handle immediately", async () => {
    const handle: AgentHandle = {
      id: "static-handle",
      status: "completed",
      createdAt: new Date().toISOString(),
      returnCode: 0,
      messages: [],
    };

    const result = await awaitAgent(handle);
    expect(result.exitCode).toBe(0);
    expect(result.error).toBeUndefined();
  });

  it("cancels a running agent before completion", async () => {
    const script = join(TMP, "slow-agent.js");
    writeFileSync(
      script,
      `
      setTimeout(() => process.exit(0), 5000);
      `
    );

    const handle = spawnAgent({
      command: "node",
      args: [script],
      cwd: TMP,
    });

    // Wait for it to start running
    await new Promise((resolve) => setTimeout(resolve, 100));
    cancelAgent(handle);
    const result = await awaitAgent(handle);
    expect(result.handle.status).toBe("cancelled");
  });

  it("creates and removes an IPC path", () => {
    const ipcPath = join(TMP, "glide-agent-test-handle.ipc");
    createIpcPath(TMP, "test-handle");
    expect(existsSync(ipcPath)).toBe(true);
    removeIpcPath(ipcPath);
    expect(existsSync(ipcPath)).toBe(false);
  });

  it("handles spawn errors gracefully", async () => {
    const handle = spawnAgent({
      command: "non-existent-binary-xyz",
      args: [],
      cwd: TMP,
    });

    const result = await awaitAgent(handle);
    expect(result.handle.status).toBe("failed");
    expect(result.handle.messages.some((m) => m.metadata?.kind === "spawn-error")).toBe(true);
  });
});
