import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import {
  MCPPluginRegistry,
  PluginLoaderRegistry,
  loadWithLoader,
  PrimeAgentSessionDurability,
} from "../packages/plugin-api/dist/index.js";
import { ExamplePluginLoader } from "../plugins/example-plugin/dist/index.js";
import type { PluginDescriptor } from "../packages/plugin-api/dist/index.js";

const __dirname = resolve(fileURLToPath(new URL(".", import.meta.url)));
const pluginDir = resolve(__dirname, "../plugins/example-plugin");

function loadManifest(): PluginDescriptor {
  return JSON.parse(
    readFileSync(join(pluginDir, "plugin.json"), "utf8")
  ) as PluginDescriptor;
}

function makeTempRoot(): string {
  return join(
    tmpdir(),
    "glide-plugin-test-" + Math.random().toString(36).slice(2, 9)
  );
}

describe("example plugin via plugin-api loader surface", () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = makeTempRoot();
  });

  afterEach(async () => {
    const { rm } = await import("node:fs/promises");
    await rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  });

  it("loads the example plugin through the manifest loader", async () => {
    const descriptor = loadManifest();
    const loader = new ExamplePluginLoader({ pluginDir });

    const instance = await loadWithLoader(loader, descriptor);
    expect(instance.descriptor.id).toBe("example-plugin");
    expect(instance.descriptor.kind).toBe("skill");
    expect(instance.loadedAt).toBeInstanceOf(Date);
    expect(instance.state).toBeDefined();
  });

  it("registers the loaded plugin in MCPPluginRegistry", async () => {
    const descriptor = loadManifest();
    const loader = new ExamplePluginLoader({ pluginDir });
    const instance = await loader.load(descriptor);

    const registry = new MCPPluginRegistry();
    registry.register(instance.descriptor);

    expect(registry.has("example-plugin")).toBe(true);
    expect(registry.load("example-plugin").descriptor.name).toBe(
      "Example Plugin"
    );
    expect(registry.list()).toHaveLength(1);
  });

  it("runs the plugin entrypoint API from instance state", async () => {
    const descriptor = loadManifest();
    const loader = new ExamplePluginLoader({ pluginDir });
    const instance = await loader.load(descriptor);

    const api = instance.state?.api as {
      describe(): string;
      run(input: string): { ok: boolean; output: string };
    };
    expect(api.describe()).toContain("Example Plugin@0.1.0");
    expect(api.run("hello")).toEqual({ ok: true, output: "echo: hello" });
  });

  it("registers the loader kind in PluginLoaderRegistry", async () => {
    const registry = new PluginLoaderRegistry();
    registry.register("example", new ExamplePluginLoader({ pluginDir }));

    expect(registry.list()).toEqual(["example"]);
    expect(registry.get("example")).toBeInstanceOf(ExamplePluginLoader);
  });

  it("persists and restores durable plugin state", async () => {
    const descriptor = loadManifest();
    const loader = new ExamplePluginLoader({ pluginDir });
    const instance = await loader.load(descriptor);

    const durability = new PrimeAgentSessionDurability({ rootDir: tempRoot });
    await durability.persist(instance);

    const restored = await durability.restore("example-plugin");
    expect(restored).toBeDefined();
    expect(restored?.api).toBeDefined();
  });

  it("rejects a descriptor that does not match the manifest", async () => {
    const loader = new ExamplePluginLoader({ pluginDir });
    await expect(
      loadWithLoader(loader, {
        ...loadManifest(),
        id: "other-plugin",
      })
    ).rejects.toMatchObject({
      name: "PluginLoadError",
      code: "INVALID_MANIFEST",
      cause: expect.objectContaining({
        message: expect.stringContaining("does not match manifest id"),
      }),
    });
  });
});
