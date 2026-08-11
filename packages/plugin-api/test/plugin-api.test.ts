import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MCPPluginRegistry } from "../src/registry.js";
import { PluginLoaderRegistry, loadWithLoader } from "../src/loader.js";
import { PrimeAgentSessionDurability } from "../src/durability.js";
import type { PluginDescriptor, PluginInstance } from "../src/types.js";
import { tmpdir } from "node:os";
import { join } from "node:path";

function makeTempRoot(): string {
  return join(
    tmpdir(),
    "glide-plugin-test-" + Math.random().toString(36).slice(2, 9)
  );
}

const baseDescriptor: PluginDescriptor = {
  id: "test-plugin",
  name: "Test Plugin",
  version: "0.1.0",
  kind: "mcp",
  mcpEndpoint: "http://localhost:5555",
  entrypoint: {
    module: "test-plugin",
    exportName: "default",
  },
};

describe("MCPPluginRegistry", () => {
  let registry: MCPPluginRegistry;

  beforeEach(() => {
    registry = new MCPPluginRegistry();
  });

  it("registers a plugin and returns an instance", () => {
    const instance = registry.register(baseDescriptor);
    expect(instance.descriptor.id).toBe("test-plugin");
    expect(instance.loadedAt).toBeInstanceOf(Date);
  });

  it("lists registered plugins", () => {
    registry.register(baseDescriptor);
    registry.register({
      ...baseDescriptor,
      id: "other-plugin",
      name: "Other Plugin",
    });

    const list = registry.list();
    expect(list).toHaveLength(2);
    expect(list.map((i) => i.descriptor.id).sort()).toEqual([
      "other-plugin",
      "test-plugin",
    ]);
  });

  it("loads a plugin by id", () => {
    registry.register(baseDescriptor);
    const loaded = registry.load("test-plugin");
    expect(loaded.descriptor.name).toBe("Test Plugin");
  });

  it("throws NOT_FOUND for unknown plugin ids", () => {
    expect(() => registry.load("missing")).toThrow("not found");
  });

  it("rejects duplicate plugin ids", () => {
    registry.register(baseDescriptor);
    expect(() => registry.register(baseDescriptor)).toThrow(
      "already registered"
    );
  });

  it("supports unregister and has", () => {
    registry.register(baseDescriptor);
    expect(registry.has("test-plugin")).toBe(true);
    const removed = registry.unregister("test-plugin");
    expect(removed).toBe(true);
    expect(registry.has("test-plugin")).toBe(false);
  });
});

describe("PluginLoaderRegistry", () => {
  it("registers and retrieves loaders by kind", () => {
    const registry = new PluginLoaderRegistry();
    const loader: IPluginLoader = {
      async load(descriptor: PluginDescriptor): Promise<PluginInstance> {
        return { descriptor, loadedAt: new Date() };
      },
    };

    registry.register("mcp", loader);
    expect(registry.get("mcp")).toBe(loader);
    expect(registry.list()).toEqual(["mcp"]);
  });

  it("rejects duplicate loader registrations", () => {
    const registry = new PluginLoaderRegistry();
    registry.register("mcp", {
      async load(descriptor: PluginDescriptor): Promise<PluginInstance> {
        return { descriptor, loadedAt: new Date() };
      },
    });

    expect(() =>
      registry.register("mcp", {
        async load(descriptor: PluginDescriptor): Promise<PluginInstance> {
          return { descriptor, loadedAt: new Date() };
        },
      })
    ).toThrow("already registered");
  });
});

describe("loadWithLoader", () => {
  it("delegates load to the provided loader", async () => {
    const expected = { descriptor: baseDescriptor, loadedAt: new Date() };
    const loader: IPluginLoader = {
      async load(): Promise<PluginInstance> {
        return expected;
      },
    };

    const result = await loadWithLoader(loader, baseDescriptor);
    expect(result).toBe(expected);
  });

  it("wraps loader errors in PluginLoadError", async () => {
    const loader: IPluginLoader = {
      async load(): Promise<PluginInstance> {
        throw new Error("boom");
      },
    };

    await expect(loadWithLoader(loader, baseDescriptor)).rejects.toThrow(
      'Failed to load plugin "test-plugin"'
    );
  });
});

describe("PrimeAgentSessionDurability", () => {
  let durability: PrimeAgentSessionDurability;
  let rootDir: string;

  beforeEach(() => {
    rootDir = makeTempRoot();
    durability = new PrimeAgentSessionDurability({ rootDir });
  });

  afterEach(async () => {
    const { rm } = await import("node:fs/promises");
    await rm(rootDir, { recursive: true, force: true }).catch(() => {});
  });

  it("persists and restores state for session-durable plugins", async () => {
    const instance: PluginInstance = {
      descriptor: { ...baseDescriptor, sessionDurable: true },
      loadedAt: new Date(),
      state: { token: "abc123" },
    };

    await durability.persist(instance);
    const restored = await durability.restore("test-plugin");

    expect(restored).toEqual({ token: "abc123" });
  });

  it("skips persistence for non-durable plugins", async () => {
    const instance: PluginInstance = {
      descriptor: { ...baseDescriptor, sessionDurable: false },
      loadedAt: new Date(),
      state: { token: "abc123" },
    };

    await durability.persist(instance);
    const restored = await durability.restore("test-plugin");
    expect(restored).toBeUndefined();
  });

  it("restores undefined when no durable state exists", async () => {
    const restored = await durability.restore("no-state-plugin");
    expect(restored).toBeUndefined();
  });

  it("removes persisted state", async () => {
    const instance: PluginInstance = {
      descriptor: { ...baseDescriptor, sessionDurable: true },
      loadedAt: new Date(),
      state: { token: "abc123" },
    };

    await durability.persist(instance);
    const removed = await durability.remove("test-plugin");
    expect(removed).toBe(true);

    const restored = await durability.restore("test-plugin");
    expect(restored).toBeUndefined();
  });

  it("clears all persisted plugin states", async () => {
    await durability.persist({
      descriptor: { ...baseDescriptor, sessionDurable: true },
      loadedAt: new Date(),
      state: { token: "abc123" },
    });

    await durability.persist({
      descriptor: { ...baseDescriptor, id: "other-plugin", sessionDurable: true },
      loadedAt: new Date(),
      state: { token: "xyz" },
    });

    await durability.clear();

    expect(await durability.restore("test-plugin")).toBeUndefined();
    expect(await durability.restore("other-plugin")).toBeUndefined();
  });

  it("overwrites existing persisted state on persist", async () => {
    await durability.persist({
      descriptor: { ...baseDescriptor, sessionDurable: true },
      loadedAt: new Date(),
      state: { token: "v1" },
    });

    await durability.persist({
      descriptor: { ...baseDescriptor, sessionDurable: true },
      loadedAt: new Date(),
      state: { token: "v2" },
    });

    expect(await durability.restore("test-plugin")).toEqual({ token: "v2" });
  });

  it("appends JSONL event stream entries for persistence operations", async () => {
    await durability.persist({
      descriptor: { ...baseDescriptor, sessionDurable: true },
      loadedAt: new Date(),
      state: { token: "abc123" },
    });

    const events = await durability.readEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "state_persisted",
      pluginId: "test-plugin",
    });
    expect(events[0].timestamp).toBeTruthy();
    expect(typeof events[0].size).toBe("number");
  });

  it("records restore and remove events in the event stream", async () => {
    await durability.persist({
      descriptor: { ...baseDescriptor, sessionDurable: true },
      loadedAt: new Date(),
      state: { token: "abc123" },
    });

    await durability.restore("test-plugin");
    await durability.remove("test-plugin");

    const events = await durability.readEvents();
    expect(events.map((event) => event.type)).toEqual([
      "state_persisted",
      "state_restored",
      "state_removed",
    ]);
  });

  it("records a clear event and resets the stream", async () => {
    await durability.clear();

    const events = await durability.readEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "state_cleared",
      pluginId: "*",
    });
  });
});
