import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const proc = spawn("node", ["dist/index.js"], {
  cwd: "/media/Storage/home-gfardad/Projects/Glide/packages/mcp-server",
  stdio: ["pipe", "pipe", "inherit"],
});

function send(p: ReturnType<typeof spawn>, payload: unknown) {
  p.stdin.write(JSON.stringify(payload) + "\n");
}

function readMessage(p: ReturnType<typeof spawn>) {
  return new Promise((resolve, reject) => {
    const onData = (chunk: Buffer) => {
      const text = chunk.toString();
      const lines = text.split("\n").filter((l) => l.trim().length > 0);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line) as Record<string, unknown>;
          resolve(parsed);
          p.stdout.off("data", onData);
          return;
        } catch {
          // partial JSON, keep reading
        }
      }
    };
    p.stdout.on("data", onData);
    setTimeout(() => {
      p.stdout.off("data", onData);
      reject(new Error("timeout waiting for MCP response"));
    }, 2000);
  });
}

(async () => {
  const id = randomUUID();
  const init = {
    jsonrpc: "2.0",
    id,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test", version: "1.0.0" },
    },
  };

  send(proc, init);
  const initResp = await readMessage(proc);
  console.log("INIT", JSON.stringify(initResp).slice(0, 200));

  send(proc, { jsonrpc: "2.0", method: "notifications/initialized" });

  send(proc, { jsonrpc: "2.0", id: randomUUID(), method: "tools/list" });
  const listResp = await readMessage(proc);
  console.log("LIST", JSON.stringify(listResp).slice(0, 200));

  send(proc, {
    jsonrpc: "2.0",
    id: randomUUID(),
    method: "tools/call",
    params: { name: "glide_status", arguments: {} },
  });
  const resp = await readMessage(proc);
  console.log("STATUS", JSON.stringify(resp).slice(0, 200));

  proc.kill("SIGTERM");
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
