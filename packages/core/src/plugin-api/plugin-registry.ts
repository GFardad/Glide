import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  entrypoint?: string;
  capabilities?: string[];
  permissions?: {
    filesystem?: "read" | "write" | "none";
    network?: boolean;
    exec?: boolean;
  };
}

export interface PluginRegistry {
  plugins: PluginManifest[];
}

const DEFAULT_REGISTRY_PATH = ".glide-plugins/registry.json";

export function resolveRegistryPath(root: string): string {
  return join(root, DEFAULT_REGISTRY_PATH);
}

export function loadRegistry(root: string): PluginRegistry {
  const path = resolveRegistryPath(root);
  if (!existsSync(path)) {
    return { plugins: [] };
  }
  try {
    const raw = readFileSync(path, "utf8");
    return JSON.parse(raw) as PluginRegistry;
  } catch {
    return { plugins: [] };
  }
}

export function saveRegistry(root: string, registry: PluginRegistry): void {
  const path = resolveRegistryPath(root);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(registry, null, 2), "utf8");
}

export function registerPlugin(root: string, manifest: PluginManifest): PluginRegistry {
  const registry = loadRegistry(root);
  if (!manifest.name || manifest.name.trim().length === 0) {
    throw new Error("Plugin manifest must include a non-empty name");
  }
  if (!manifest.version || manifest.version.trim().length === 0) {
    throw new Error("Plugin manifest must include a non-empty version");
  }
  const exists = registry.plugins.some((plugin) => plugin.name === manifest.name);
  if (exists) {
    registry.plugins = registry.plugins.map((plugin) =>
      plugin.name === manifest.name ? manifest : plugin
    );
  } else {
    registry.plugins.push(manifest);
  }
  saveRegistry(root, registry);
  return registry;
}

export function listPlugins(root: string): PluginManifest[] {
  return loadRegistry(root).plugins;
}
