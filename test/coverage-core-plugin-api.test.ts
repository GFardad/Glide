import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  MinimalPluginManifestSchema,
  validatePluginManifest,
  loadRegistry,
  saveRegistry,
  registerPlugin,
  listPlugins,
  resolveRegistryPath,
} from "../packages/core/src/plugin-api/index.js";
import type { MinimalPluginManifest } from "../packages/core/src/plugin-api/manifest.js";

describe("core plugin-api manifest + loader", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = join("/tmp", "glide-core-plugin-api-test", String(Date.now()));
    if (existsSync(tmpRoot)) {
      rmSync(tmpRoot, { recursive: true });
    }
    mkdirSync(tmpRoot, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tmpRoot)) {
      rmSync(tmpRoot, { recursive: true });
    }
  });

  it("defines a minimal manifest schema", () => {
    const manifest: MinimalPluginManifest = {
      id: "demo",
      name: "Demo",
      version: "1.0.0",
      description: "Demo plugin",
      entrypoint: "dist/demo.js",
      capabilities: ["mcp"],
      permissions: { filesystem: "read", network: true, exec: false },
    };

    expect(MinimalPluginManifestSchema.parse(manifest)).toEqual(manifest);
  });

  it("validates missing required fields", () => {
    expect(validatePluginManifest({})).toEqual({
      valid: false,
      errors: expect.arrayContaining([
        expect.stringContaining("id"),
        expect.stringContaining("name"),
        expect.stringContaining("version"),
      ]),
      warnings: [],
    });
  });

  it("rejects blank id/name/version on registration", () => {
    expect(() =>
      registerPlugin({ root: tmpRoot }, { id: " ", name: "demo", version: "1.0.0" })
    ).toThrowError(/Invalid plugin manifest/);
    expect(listPlugins({ root: tmpRoot })).toEqual([]);
  });

  it("passes for a manifest with only required fields", () => {
    expect(validatePluginManifest({ id: "x", name: "X", version: "1.0.0" })).toEqual({
      valid: true,
      errors: [],
      warnings: [],
    });
  });

  it("resolves the registry path", () => {
    expect(resolveRegistryPath({ root: "/workspace" })).toBe(
      join("/workspace", "registry.json")
    );
    expect(resolveRegistryPath({ root: "/workspace", filename: "plugins.json" })).toBe(
      join("/workspace", "plugins.json")
    );
  });

  it("returns an empty registry when the file does not exist", () => {
    expect(loadRegistry({ root: tmpRoot })).toEqual({ plugins: [] });
  });

  it("persists and reloads registered manifests", async () => {
    const manifest: MinimalPluginManifest = {
      id: "first",
      name: "First",
      version: "1.0.0",
    };

    registerPlugin({ root: tmpRoot }, manifest);
    const registry = loadRegistry({ root: tmpRoot });

    expect(registry.plugins).toHaveLength(1);
    expect(registry.plugins[0]).toEqual(manifest);
  });

  it("updates an existing manifest by id", async () => {
    registerPlugin({ root: tmpRoot }, {
      id: "same",
      name: "Old",
      version: "1.0.0",
    });
    registerPlugin({ root: tmpRoot }, {
      id: "same",
      name: "New",
      version: "2.0.0",
    });

    expect(listPlugins({ root: tmpRoot })).toEqual([
      { id: "same", name: "New", version: "2.0.0" },
    ]);
  });

  it("rejects invalid manifests on registration", async () => {
    expect(() =>
      registerPlugin({ root: tmpRoot }, { id: "", name: "bad", version: "1.0.0" } as any)
    ).toThrowError(/Invalid plugin manifest/);
    expect(listPlugins({ root: tmpRoot })).toEqual([]);
  });

  it("ignores invalid entries while loading persisted registry", async () => {
    const raw = {
      plugins: [
        { id: "good", name: "Good", version: "1.0.0" },
        { id: "bad", name: "", version: "1.0.0" },
      ],
    };

    saveRegistry({ root: tmpRoot }, raw as any);
    expect(listPlugins({ root: tmpRoot })).toEqual([
      { id: "good", name: "Good", version: "1.0.0" },
    ]);
  });
});
