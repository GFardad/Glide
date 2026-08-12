import { describe, it, expect } from "vitest";
import { HostBridge } from "../packages/mcp-server/src/bridge/HostBridge.js";
import type { HostRoute } from "../packages/mcp-server/src/bridge/types.js";

/**
 * Coverage tests for packages/mcp-server/src/bridge/HostBridge.ts.
 * Registers routes and exercises success, parse error, invalid request,
 * missing method, handler failure, and notification paths.
 */

function makeRoute(name: string): HostRoute<{ name: string }, { greeting: string }> {
  return {
    method: name,
    handler: async (request) => {
      return { greeting: `hello ${request.params.name}` };
    },
  };
}

describe("HostBridge", () => {
  it("registers routes and dispatches a valid request", async () => {
    const bridge = new HostBridge();
    bridge.on(makeRoute("greet"));
    const response = await bridge.handle(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "greet",
        params: { name: "world" },
      })
    );
    const parsed = JSON.parse(response);
    expect(parsed.id).toBe(1);
    expect(parsed.result.greeting).toBe("hello world");
  });

  it("returns a parse error for invalid JSON", async () => {
    const bridge = new HostBridge();
    const response = await bridge.handle("not-json");
    const parsed = JSON.parse(response);
    expect(parsed.error.code).toBe(-32700);
  });

  it("returns an invalid request error for non-object envelopes", async () => {
    const bridge = new HostBridge();
    const response = await bridge.handle("null");
    const parsed = JSON.parse(response);
    expect(parsed.error.code).toBe(-32600);
  });

  it("returns method not found when no route matches", async () => {
    const bridge = new HostBridge();
    const response = await bridge.handle(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "unknown",
      })
    );
    const parsed = JSON.parse(response);
    expect(parsed.error.code).toBe(-32601);
  });

  it("surfaces handler failures as internal errors", async () => {
    const bridge = new HostBridge();
    bridge.on({
      method: "boom",
      handler: async () => {
        throw new Error("kaboom");
      },
    });
    const response = await bridge.handle(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "boom",
      })
    );
    const parsed = JSON.parse(response);
    expect(parsed.error.code).toBe(-32603);
    expect(parsed.error.message).toBe("kaboom");
  });

  it("returns an empty string for notifications without an id", async () => {
    const bridge = new HostBridge();
    bridge.on({
      method: "notify",
      handler: async () => "ignored",
    });
    const response = await bridge.handle(
      JSON.stringify({
        jsonrpc: "2.0",
        method: "notify",
      })
    );
    expect(response).toBe("");
  });

  it("returns an empty string for failed notifications without an id", async () => {
    const bridge = new HostBridge();
    bridge.on({
      method: "notify-fail",
      handler: async () => {
        throw new Error("silent");
      },
    });
    const response = await bridge.handle(
      JSON.stringify({
        jsonrpc: "2.0",
        method: "notify-fail",
      })
    );
    expect(response).toBe("");
  });
});
