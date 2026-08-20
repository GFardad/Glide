import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { validatePluginManifest } from "./manifest.js";
const DEFAULT_FILENAME = "registry.json";
export function resolveRegistryPath(options) {
    return join(options.root, options.filename ?? DEFAULT_FILENAME);
}
export function loadRegistry(options) {
    const path = resolveRegistryPath(options);
    if (!existsSync(path)) {
        return { plugins: [] };
    }
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.plugins)) {
        return { plugins: [] };
    }
    const plugins = [];
    for (const entry of parsed.plugins) {
        const validation = validatePluginManifest(entry);
        if (validation.valid) {
            plugins.push(entry);
        }
    }
    return { plugins };
}
export function saveRegistry(options, registry) {
    const path = resolveRegistryPath(options);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(registry, null, 2), "utf8");
}
export function registerPlugin(options, manifest) {
    const validation = validatePluginManifest(manifest);
    if (!validation.valid) {
        throw new Error(`Invalid plugin manifest: ${validation.errors.join(", ")}`);
    }
    const registry = loadRegistry(options);
    const existing = registry.plugins.find((plugin) => plugin.id === manifest.id);
    if (existing) {
        registry.plugins = registry.plugins.map((plugin) => plugin.id === manifest.id ? manifest : plugin);
    }
    else {
        registry.plugins.push(manifest);
    }
    saveRegistry(options, registry);
    return registry;
}
export function listPlugins(options) {
    return loadRegistry(options).plugins;
}
//# sourceMappingURL=loader.js.map