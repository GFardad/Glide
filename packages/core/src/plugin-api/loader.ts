import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import type { MinimalPluginManifest, ManifestValidationResult } from "./manifest.js";
import { validatePluginManifest } from "./manifest.js";

export interface PluginRegistry {
  plugins: MinimalPluginManifest[];
}

export interface PluginLoaderOptions {
  root: string;
  filename?: string;
}

const DEFAULT_FILENAME = "registry.json";

export function resolveRegistryPath(options: PluginLoaderOptions): string {
  return join(options.root, options.filename ?? DEFAULT_FILENAME);
}

export function loadRegistry(options: PluginLoaderOptions): PluginRegistry {
  const path = resolveRegistryPath(options);

  if (!existsSync(path)) {
    return { plugins: [] };
  }

  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw) as { plugins?: unknown[] };

  if (!Array.isArray(parsed.plugins)) {
    return { plugins: [] };
  }

  const plugins: MinimalPluginManifest[] = [];

  for (const entry of parsed.plugins) {
    const validation = validatePluginManifest(entry);
    if (validation.valid) {
      plugins.push(entry as MinimalPluginManifest);
    }
  }

  return { plugins };
}

export function saveRegistry(options: PluginLoaderOptions, registry: PluginRegistry): void {
  const path = resolveRegistryPath(options);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(registry, null, 2), "utf8");
}

export function registerPlugin(
  options: PluginLoaderOptions,
  manifest: MinimalPluginManifest
): PluginRegistry {
  const validation = validatePluginManifest(manifest);
  if (!validation.valid) {
    throw new Error(`Invalid plugin manifest: ${validation.errors.join(", ")}`);
  }

  const registry = loadRegistry(options);
  const existing = registry.plugins.find((plugin) => plugin.id === manifest.id);

  if (existing) {
    registry.plugins = registry.plugins.map((plugin) =>
      plugin.id === manifest.id ? manifest : plugin
    );
  } else {
    registry.plugins.push(manifest);
  }

  saveRegistry(options, registry);
  return registry;
}

export function listPlugins(options: PluginLoaderOptions): MinimalPluginManifest[] {
  return loadRegistry(options).plugins;
}
