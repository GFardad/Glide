import { describe, it, expect } from "vitest";

describe("Glide monorepo scaffold", () => {
  it("should have core package importable", async () => {
    const core = await import("../packages/core/src/index.ts");
    expect(core).toBeDefined();
  });

  it("should have mcp-server package importable", async () => {
    const mcp = await import("../packages/mcp-server/src/index.ts");
    expect(mcp).toBeDefined();
  });

  it("should have headroom package importable", async () => {
    const headroom = await import("../packages/headroom/src/index.ts");
    expect(headroom).toBeDefined();
  });

  it("should have executor package importable", async () => {
    const executor = await import("../packages/executor/src/index.ts");
    expect(executor).toBeDefined();
  });

  it("should have tracer package importable", async () => {
    const tracer = await import("../packages/tracer/src/index.ts");
    expect(tracer).toBeDefined();
  });

  it("should have permissions package importable", async () => {
    const permissions = await import("../packages/permissions/src/index.ts");
    expect(permissions).toBeDefined();
  });

  it("should have plugin-api package importable", async () => {
    const pluginApi = await import("../packages/plugin-api/src/index.ts");
    expect(pluginApi).toBeDefined();
  });
});
