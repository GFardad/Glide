import { describe, it, expect, beforeEach } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const CLI = join(process.cwd(), "packages", "cli", "dist", "cli.js");

function runCli(args: string[]): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    const child = spawn("node", [CLI, ...args], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf-8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf-8");
    });
    child.on("close", (code) => {
      resolve({ stdout, stderr, code: code ?? null });
    });
  });
}

describe("cli coverage gaps", () => {
  const tmpRoot = "/tmp/glide-cli-coverage-test";

  beforeEach(() => {
    if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true });
    mkdirSync(tmpRoot, { recursive: true });
  });

  it("shows help when invoked with --help", async () => {
    const result = await runCli(["--help"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("glide");
    expect(result.stdout).toContain("Commands:");
  });

  it("returns status in text format", async () => {
    const result = await runCli(["status", "--project", tmpRoot]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("status:");
    expect(result.stdout).toContain("version:");
  });

  it("returns status in json format", async () => {
    const result = await runCli(["--json", "status", "--project", tmpRoot]);
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout.trim());
    expect(parsed.status).toBe("ok");
    expect(typeof parsed.version).toBe("string");
  });

  it("sets and gets a campaign goal", async () => {
    const campaignDir = join(tmpRoot, "campaign");
    mkdirSync(campaignDir, { recursive: true });

    const setResult = await runCli(["goal-set", campaignDir, "Cover CLI"]);
    expect(setResult.code).toBe(0);
    expect(setResult.stdout).toContain("ok");

    const getResult = await runCli(["goal-get", campaignDir]);
    expect(getResult.code).toBe(0);
    expect(getResult.stdout).toContain("Cover CLI");
  });

  it("rejects invalid json format", async () => {
    const result = await runCli(["--format", "xml", "status"]);
    expect(result.code).not.toBe(0);
    expect(result.stderr || result.stdout).toMatch(/format|json|xml/i);
  });

  it("handles unknown commands with guidance", async () => {
    const result = await runCli(["unknown-command"]);
    expect(result.code).not.toBe(0);
    const output = result.stderr || result.stdout;
    expect(output.length).toBeGreaterThan(0);
  });

  it("runs headroom with custom roles", async () => {
    const campaignDir = join(tmpRoot, "headroom");
    mkdirSync(campaignDir, { recursive: true });
    writeFileSync(join(campaignDir, "GOAL.md"), "# Goal\nReduce risk\n");
    writeFileSync(join(campaignDir, "NON_GOALS.md"), "- scope creep\n");
    writeFileSync(join(campaignDir, "ASSUMPTIONS.md"), "- team available\n");
    const result = await runCli([
      "--json",
      "headroom",
      campaignDir,
      "Reduce risk",
      "--roles",
      "cto,eng",
    ]);
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout.trim());
    expect(parsed.ok).toBe(true);
    expect(parsed.objective).toBe("Reduce risk");
    expect(parsed.roles).toEqual(["cto", "eng"]);
    expect(parsed.drift_detected).toBe(true);
    expect(typeof parsed.artifacts.risk_log).toBe("string");
  });

  it("records a build artifact", async () => {
    const campaignDir = join(tmpRoot, "build");
    mkdirSync(campaignDir, { recursive: true });
    const result = await runCli([
      "--json",
      "build",
      campaignDir,
      "--team",
      "platform",
      "--status",
      "green",
    ]);
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout.trim());
    expect(parsed.ok).toBe(true);
    expect(parsed.tool).toBe("glide_build");
    expect(typeof parsed.path).toBe("string");
    expect(parsed.path).toContain("build_");
  });

  it("records a review artifact", async () => {
    const campaignDir = join(tmpRoot, "review");
    mkdirSync(campaignDir, { recursive: true });
    const result = await runCli([
      "--json",
      "review",
      campaignDir,
      "approved",
      "--reviewer",
      "alice",
    ]);
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout.trim());
    expect(parsed.ok).toBe(true);
    expect(parsed.tool).toBe("glide_review");
    expect(typeof parsed.path).toBe("string");
    expect(parsed.path).toContain("review_");
  });

  it("records a ship artifact", async () => {
    const campaignDir = join(tmpRoot, "ship");
    mkdirSync(campaignDir, { recursive: true });
    const result = await runCli([
      "--json",
      "ship",
      campaignDir,
      "production",
      "--status",
      "released",
    ]);
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout.trim());
    expect(parsed.ok).toBe(true);
    expect(parsed.tool).toBe("glide_ship");
    expect(typeof parsed.path).toBe("string");
    expect(parsed.path).toContain("ship_");
  });

  it("runs permissions check", async () => {
    const result = await runCli([
      "--json",
      "permissions",
      "read",
      "specs",
      "user-1",
      "engineer",
    ]);
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout.trim());
    expect(parsed.ok).toBe(true);
    expect(parsed.allowed).toBe(true);
  });

  it("traces an agent chain", async () => {
    const workspace = join(tmpRoot, "workspace");
    mkdirSync(join(workspace, "agents", "agent-1"), { recursive: true });
    writeFileSync(join(workspace, "agents", "agent-1", "GOAL.md"), "# Goal\nCLI trace\n");
    writeFileSync(join(workspace, "agents", "agent-1", "PERSONALITY.md"), "Parent: none\n");
    writeFileSync(join(workspace, "agents", "agent-1", "NOTES.md"), "- note\n");
    writeFileSync(join(workspace, "agents", "agent-1", "TODO.md"), "- todo\n");

    const result = await runCli(["--json", "trace", workspace, "agent-1"]);
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout.trim());
    expect(parsed.ok).toBe(true);
    expect(parsed.agent_id).toBe("agent-1");
  });

  it("indepth dumps agent context", async () => {
    const workspace = join(tmpRoot, "workspace2");
    mkdirSync(join(workspace, "agents", "agent-2"), { recursive: true });
    writeFileSync(join(workspace, "agents", "agent-2", "GOAL.md"), "# Goal\nindepth\n");
    writeFileSync(join(workspace, "agents", "agent-2", "PERSONALITY.md"), "Parent: none\n");
    writeFileSync(join(workspace, "agents", "agent-2", "NOTES.md"), "- note\n");
    writeFileSync(join(workspace, "agents", "agent-2", "TODO.md"), "- todo\n");

    const result = await runCli(["--json", "indepth", workspace, "agent-2"]);
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout.trim());
    expect(parsed.ok).toBe(true);
    expect(parsed.agent_id).toBe("agent-2");
    expect(typeof parsed.path).toBe("string");
  });
});
