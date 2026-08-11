import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

describe("e2e mcp stdio", () => {
  it("verifies all tools respond successfully", async () => {
    const root = "/tmp/glide-e2e-test";
    if (existsSync(root)) rmSync(root, { recursive: true });
    mkdirSync(root, { recursive: true });

    const campaignDir = join(root, "campaign");
    mkdirSync(campaignDir, { recursive: true });
    writeFileSync(
      join(campaignDir, "campaign.json"),
      JSON.stringify(
        {
          id: "c1",
          root: campaignDir,
          goal: "E2E",
          nonGoals: [],
          assumptions: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        null,
        2
      ),
      "utf8"
    );

    const proc = spawn("node", ["dist/index.js"], {
      cwd: "/media/Storage/home-gfardad/Projects/Glide/packages/mcp-server",
      stdio: ["pipe", "pipe", "inherit"],
    });
    const tools = [
      {
        name: "glide_headroom",
        args: {
          action: "run",
          campaign_dir: campaignDir,
          objective: "E2E verification",
          roles: ["QA"],
        },
      },
      {
        name: "glide_executor",
        args: {
          action: "ensure_contract",
          workspace: root,
          agent_id: "agent-1",
        },
      },
      {
        name: "glide_tracer",
        args: { action: "trace", workspace: root, agent_id: "agent-1" },
      },
      {
        name: "glide_permissions",
        args: {
          action: "authorize",
          subject_id: "sub-1",
          subject_role: "QA",
          verb: "read",
          resource: "artifact",
        },
      },
    ];

    let buffer = "";
    const pending = new Map<
      string,
      { resolve: (value: unknown) => void; reject: (err: unknown) => void }
    >();

    proc.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      let boundary;
      while ((boundary = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, boundary).trim();
        buffer = buffer.slice(boundary + 1);
        if (!line) continue;
        try {
          const parsed = JSON.parse(line);
          if (
            parsed.id &&
            typeof parsed.id === "string" &&
            pending.has(parsed.id)
          ) {
            const entry = pending.get(parsed.id)!;
            pending.delete(parsed.id);
            entry.resolve(parsed);
          }
        } catch {
          // ignore parse errors for partial JSON lines
        }
      }
    });

    function send(message: Record<string, unknown>) {
      proc.stdin.write(JSON.stringify(message) + "\n");
    }

    function readMessage(id: string): Promise<unknown> {
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        setTimeout(() => {
          if (pending.has(id)) {
            pending.delete(id);
            reject(new Error("timeout"));
          }
        }, 2000);
      });
    }

    try {
      send({
        jsonrpc: "2.0",
        id: "init-1",
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "e2e", version: "1.0.0" },
        },
      });
      await readMessage("init-1");
      send({ jsonrpc: "2.0", method: "notifications/initialized" });

      for (const tool of tools) {
        const id = `tool-${tool.name}`;
        send({
          jsonrpc: "2.0",
          id,
          method: "tools/call",
          params: { name: tool.name, arguments: tool.args },
        });
        const resp = await readMessage(id);
        expect(resp).toMatchObject({ jsonrpc: "2.0" });
        expect(resp).not.toHaveProperty("error");
      }

      proc.kill("SIGTERM");
    } catch (err) {
      proc.kill("SIGTERM");
      throw err;
    }
  });
});
