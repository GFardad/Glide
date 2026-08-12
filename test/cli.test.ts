import { describe, it, expect, beforeEach } from "vitest";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createCampaign } from "../packages/core/src/campaign/index.js";

const CLI_ENTRY = join(process.cwd(), "packages/cli/dist/cli.js");

async function runCli(args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const child = spawn("node", [CLI_ENTRY, ...args], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  const chunks: Buffer[] = [];
  const errorChunks: Buffer[] = [];

  return new Promise((resolve) => {
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => errorChunks.push(chunk));
    child.on("close", (code) => {
      resolve({
        code: code ?? 0,
        stdout: Buffer.concat(chunks).toString("utf8").trim(),
        stderr: Buffer.concat(errorChunks).toString("utf8").trim(),
      });
    });
  });
}

describe("glide CLI", () => {
  const tmpRoot = "/tmp/glide-cli-test";

  beforeEach(() => {
    if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true });
    mkdirSync(tmpRoot, { recursive: true });
  });

  it("prints help when invoked with no args", async () => {
    const result = await runCli([]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("glide — Glide MCP stdio CLI");
  });

  it("prints help for an unknown command", async () => {
    const result = await runCli(["nope"]);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("Unknown command");
  });

  it("returns status in text format", async () => {
    const result = await runCli(["status"]);
    expect(result.code).toBe(0);
    const text = result.stdout;
    expect(text).toContain("status: ok");
  });

  it("returns status in json format", async () => {
    const result = await runCli(["--format", "json", "status"]);
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.status).toBe("ok");
  });

  it("sets and gets a campaign goal", async () => {
    const dir = join(tmpRoot, "campaign");
    const setResult = await runCli(["goal-set", dir, "Build the CLI"]);
    expect(setResult.code).toBe(0);
    expect(setResult.stdout).toContain("ok: true");
    expect(setResult.stdout).toContain("Build the CLI");

    const getResult = await runCli(["goal-get", dir]);
    expect(getResult.code).toBe(0);
    expect(getResult.stdout).toContain("Build the CLI");
  });

  it("creates a plan artifact", async () => {
    const dir = join(tmpRoot, "plan-campaign");
    createCampaign(dir, "Ship CLI", [], []);
    const result = await runCli(["plan", dir, "Ship CLI"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("tool: glide_plan");
    expect(existsSync(join(dir, "plan"))).toBe(true);
  });

  it("records a build artifact", async () => {
    const dir = join(tmpRoot, "build-campaign");
    createCampaign(dir, "Build CLI", [], []);
    const result = await runCli(["build", dir, "--team", "platform", "--status", "success"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("tool: glide_build");
  });

  it("records a test artifact with passed flag", async () => {
    const dir = join(tmpRoot, "test-campaign");
    createCampaign(dir, "Test CLI", [], []);
    const result = await runCli(["test", dir, "--team", "qa", "--passed", "--summary", "all green"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("tool: glide_test");
  });

  it("records a review artifact", async () => {
    const dir = join(tmpRoot, "review-campaign");
    createCampaign(dir, "Review CLI", [], []);
    const result = await runCli(["review", dir, "approved", "--reviewer", "cto"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("tool: glide_review");
  });

  it("records a ship artifact", async () => {
    const dir = join(tmpRoot, "ship-campaign");
    createCampaign(dir, "Ship CLI", [], []);
    const result = await runCli(["ship", dir, "stable", "--channel", "stable"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("tool: glide_ship");
  });

  it("runs trace and indepth commands", async () => {
    const workspace = join(tmpRoot, "ws");
    const agentDir = join(workspace, "agents", "agent-1");
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(join(agentDir, "GOAL.md"), "# Goal\n\nAgent goal\n");
    writeFileSync(join(agentDir, "PERSONALITY.md"), "# Personality\n\nParent: none\n");
    writeFileSync(join(agentDir, "NOTES.md"), "- note");
    writeFileSync(join(agentDir, "TODO.md"), "- todo");

    const traceResult = await runCli(["trace", workspace, "agent-1"]);
    expect(traceResult.code).toBe(0);
    expect(traceResult.stdout).toContain("ok: true");
    expect(traceResult.stdout).toContain("agent_id: agent-1");
    expect(traceResult.stdout).toContain("trace:");

    const indepthResult = await runCli(["indepth", workspace, "agent-1"]);
    expect(indepthResult.code).toBe(0);
    expect(indepthResult.stdout).toContain("ok: true");
    expect(indepthResult.stdout).toContain("agent_id: agent-1");
  });

  it("checks permissions", async () => {
    const result = await runCli(["permissions", "read", "docs", "agent-1", "engineer"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("ok: true");
  });

  it("queries graph action with project path", async () => {
    const result = await runCli(["graph", "query", tmpRoot, "--question", "glide", "--depth", "1"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("tool: glide_graph");
  });
});
