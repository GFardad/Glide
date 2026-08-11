import { describe, it, expect, beforeEach } from "vitest";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { MCPPluginRegistry } from "../packages/plugin-api/src/registry.js";
import {
  PluginLoaderRegistry,
  loadWithLoader,
  type IPluginLoader,
} from "../packages/plugin-api/src/loader.js";
import {
  PluginLoadError,
  type PluginDescriptor,
  type PluginInstance,
} from "../packages/plugin-api/src/types.js";
import { PrimeAgentSessionDurability } from "../packages/plugin-api/src/durability.js";

/**
 * Coverage gap tests for packages/plugin-api/src (registry, loader, types,
 * durability). No existing tests exercise this package.
 */

function makeDescriptor(
  overrides: Partial<PluginDescriptor> = {}
): PluginDescriptor {
  return {
    id: "mcp-demo",
    name: "Demo Plugin",
    version: "1.0.0",
    kind: "mcp",
    entrypoint: { module: "./demo.js", exportName: "demo" },
    ...overrides,
  };
}

describe("MCPPluginRegistry", () => {
  it("registers a plugin and returns an instance", () => {
    const registry = new MCPPluginRegistry();
    const descriptor = makeDescriptor();
    const instance = registry.register(descriptor);

    expect(instance.descriptor.id).toBe("mcp-demo");
    expect(instance.loadedAt).toBeInstanceOf(Date);
    expect(registry.has("mcp-demo")).toBe(true);
  });

  it("rejects duplicate plugin ids", () => {
    const registry = new MCPPluginRegistry();
    registry.register(makeDescriptor());
    expect(() => registry.register(makeDescriptor())).toThrowError(
      expect.objectContaining({ code: "DUPLICATE_ID" })
    );
  });

  it("lists registered instances", () => {
    const registry = new MCPPluginRegistry();
    registry.register(makeDescriptor({ id: "a" }));
    registry.register(makeDescriptor({ id: "b" }));
    expect(
      registry
        .list()
        .map((i) => i.descriptor.id)
        .sort()
    ).toEqual(["a", "b"]);
  });

  it("loads a registered instance by id", () => {
    const registry = new MCPPluginRegistry();
    registry.register(makeDescriptor({ id: "x" }));
    expect(registry.load("x").descriptor.id).toBe("x");
  });

  it("throws PluginLoadError when loading an unknown id", () => {
    const registry = new MCPPluginRegistry();
    expect(() => registry.load("missing")).toThrowError(
      expect.objectContaining({ code: "NOT_FOUND" })
    );
  });

  it("unregisters and reports removal", () => {
    const registry = new MCPPluginRegistry();
    registry.register(makeDescriptor({ id: "y" }));
    expect(registry.unregister("y")).toBe(true);
    expect(registry.unregister("y")).toBe(false);
    expect(registry.has("y")).toBe(false);
  });
});

describe("PluginLoaderRegistry", () => {
  const loader: IPluginLoader = {
    load: async (descriptor) => ({
      descriptor,
      loadedAt: new Date(),
    }),
  };

  it("registers, gets, and lists loaders by kind", () => {
    const registry = new PluginLoaderRegistry();
    registry.register("mcp", loader);
    expect(registry.get("mcp")).toBe(loader);
    expect(registry.get("nope")).toBeUndefined();
    expect(registry.list()).toEqual(["mcp"]);
  });

  it("rejects duplicate loader kinds", () => {
    const registry = new PluginLoaderRegistry();
    registry.register("mcp", loader);
    expect(() => registry.register("mcp", loader)).toThrowError(
      expect.objectContaining({ code: "INVALID_MANIFEST" })
    );
  });

  it("loadWithLoader returns the instance on success", async () => {
    const instance = await loadWithLoader(loader, makeDescriptor());
    expect(instance.descriptor.id).toBe("mcp-demo");
  });

  it("loadWithLoader preserves PluginLoadError codes", async () => {
    const failing: IPluginLoader = {
      load: async () => {
        throw new PluginLoadError("NOT_FOUND", "gone", undefined);
      },
    };
    await expect(
      loadWithLoader(failing, makeDescriptor())
    ).rejects.toThrowError(expect.objectContaining({ code: "NOT_FOUND" }));
  });

  it("loadWithLoader wraps generic failures as LOAD_FAILED", async () => {
    const failing: IPluginLoader = {
      load: async () => {
        throw new Error("boom");
      },
    };
    await expect(
      loadWithLoader(failing, makeDescriptor())
    ).rejects.toThrowError(expect.objectContaining({ code: "LOAD_FAILED" }));
  });
});

describe("PluginLoadError", () => {
  it("carries code, message, and cause", () => {
    const cause = new Error("root cause");
    const error = new PluginLoadError(
      "INVALID_MANIFEST",
      "bad manifest",
      cause
    );
    expect(error.code).toBe("INVALID_MANIFEST");
    expect(error.message).toBe("bad manifest");
    expect(error.cause).toBe(cause);
    expect(error.name).toBe("PluginLoadError");
    expect(error instanceof Error).toBe(true);
  });
});

describe("PrimeAgentSessionDurability", () => {
  const tmpRoot = "/tmp/glide-plugin-durability-test";

  beforeEach(() => {
    if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true });
  });

  function makeInstance(
    overrides: Partial<PluginInstance> = {}
  ): PluginInstance {
    return {
      descriptor: makeDescriptor({
        id: "durable-plugin",
        sessionDurable: true,
      }),
      loadedAt: new Date("2026-01-01T00:00:00.000Z"),
      state: { counter: 3 },
      ...overrides,
    };
  }

  it("skips persistence for non-durable plugins", async () => {
    const durability = new PrimeAgentSessionDurability({
      rootDir: join(tmpRoot, "state"),
    });
    const instance = makeInstance({
      descriptor: makeDescriptor({ id: "volatile", sessionDurable: false }),
    });
    await durability.persist(instance);
    expect(existsSync(join(tmpRoot, "state", "volatile.json"))).toBe(false);
  });


  it("restores undefined when no state file exists", async () => {
    const durability = new PrimeAgentSessionDurability({
      rootDir: join(tmpRoot, "state"),
    });
    expect(await durability.restore("missing-plugin")).toBeUndefined();
  });

  it("restores undefined when the persisted id mismatches", async () => {
    const durability = new PrimeAgentSessionDurability({
      rootDir: join(tmpRoot, "state"),
    });
    await durability.persist(makeInstance());
    // Overwrite with a payload whose id differs.
    const { writeFile } = await import("node:fs/promises");
    await writeFile(
      join(tmpRoot, "state", "durable-plugin.json"),
      JSON.stringify({ id: "other", loadedAt: "", state: { x: 1 } })
    );
    expect(await durability.restore("durable-plugin")).toBeUndefined();
  });

  it("removes persisted state and reports false when absent", async () => {
    const durability = new PrimeAgentSessionDurability({
      rootDir: join(tmpRoot, "state"),
    });
    await durability.persist(makeInstance());
    expect(await durability.remove("durable-plugin")).toBe(true);
    expect(await durability.remove("durable-plugin")).toBe(false);
  });

});
