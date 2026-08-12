import { describe, it, expect } from "vitest";
import type {
  PluginDescriptor,
  PluginInstance,
  PluginManifest,
  PluginManifestValidationResult,
} from "../packages/plugin-api/src/types.js";

/**
 * Coverage tests for packages/plugin-api/src/types.ts.
 * This file only exports interfaces/types, so coverage comes from exercising
 * those types directly and validating shape constraints.
 */

describe("plugin-api types", () => {
  it("creates a minimal PluginDescriptor", () => {
    const descriptor: PluginDescriptor = {
      id: "demo",
      name: "Demo",
      version: "1.0.0",
      kind: "mcp",
      entrypoint: { module: "./demo.js", exportName: "demo" },
    };
    expect(descriptor.id).toBe("demo");
    expect(descriptor.kind).toBe("mcp");
    expect(descriptor.manifest).toBeUndefined();
  });

  it("creates a PluginDescriptor with all optional fields", () => {
    const descriptor: PluginDescriptor = {
      id: "full",
      name: "Full",
      version: "2.0.0",
      description: "A full plugin",
      author: "Test",
      homepage: "https://example.com",
      mcpEndpoint: "https://example.com/mcp",
      kind: "agent-hook",
      sessionDurable: true,
      tags: ["test"],
      entrypoint: { module: "./full.js", exportName: "full" },
      manifest: {
        id: "full",
        name: "Full",
        version: "2.0.0",
        kind: "agent-hook",
        entrypoint: { module: "./full.js", exportName: "full" },
        permissions: { network: true, filesystem: false },
        resourceLimits: { maxMemoryMb: 128, timeoutMs: 5000 },
      },
    };
    expect(descriptor.description).toBe("A full plugin");
    expect(descriptor.tags).toContain("test");
    expect(descriptor.manifest?.permissions?.network).toBe(true);
  });

  it("creates a PluginInstance with state", () => {
    const instance: PluginInstance = {
      descriptor: {
        id: "stateful",
        name: "Stateful",
        version: "1.0.0",
        kind: "skill",
        entrypoint: { module: "./stateful.js", exportName: "stateful" },
      },
      loadedAt: new Date("2025-01-01T00:00:00.000Z"),
      state: { counter: 42 },
    };
    expect(instance.state?.counter).toBe(42);
    expect(instance.loadedAt).toBeInstanceOf(Date);
  });

  it("creates a PluginManifest with required fields", () => {
    const manifest: PluginManifest = {
      id: "m",
      name: "M",
      version: "1.0.0",
      kind: "mcp",
      entrypoint: { module: "./m.js", exportName: "m" },
    };
    expect(manifest.id).toBe("m");
    expect(manifest.permissions).toBeUndefined();
  });

  it("creates a PluginManifestValidationResult", () => {
    const result: PluginManifestValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };
    expect(result.valid).toBe(true);
  });

  it("creates a PluginManifestValidationResult with errors", () => {
    const result: PluginManifestValidationResult = {
      valid: false,
      errors: ["missing id"],
      warnings: ["deprecated field"],
    };
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("missing id");
  });
});
