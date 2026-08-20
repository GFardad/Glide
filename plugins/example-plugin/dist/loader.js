import { readFileSync, existsSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { PluginLoadError } from "@glide/plugin-api";
/**
 * Loader for the example plugin. Reads plugin.json as the PluginDescriptor,
 * dynamically imports the entrypoint module, and instantiates the plugin by
 * calling the configured export name.
 */
export class ExamplePluginLoader {
    pluginDir;
    constructor(options) {
        this.pluginDir = options.pluginDir;
    }
    async resolve(descriptor) {
        const manifestPath = join(this.pluginDir, "plugin.json");
        if (!existsSync(manifestPath)) {
            throw new PluginLoadError("NOT_FOUND", `Manifest not found: ${manifestPath}`);
        }
        return descriptor.id === readManifest(manifestPath).id;
    }
    async load(descriptor) {
        const manifestPath = join(this.pluginDir, "plugin.json");
        if (!existsSync(manifestPath)) {
            throw new PluginLoadError("NOT_FOUND", `Manifest not found: ${manifestPath}`);
        }
        const manifest = readManifest(manifestPath);
        if (manifest.id !== descriptor.id) {
            throw new PluginLoadError("INVALID_MANIFEST", `Descriptor id "${descriptor.id}" does not match manifest id "${manifest.id}"`);
        }
        const modulePath = join(this.pluginDir, manifest.entrypoint.module);
        if (!existsSync(modulePath)) {
            throw new PluginLoadError("LOAD_FAILED", `Entrypoint module not found: ${modulePath}`);
        }
        const resolvedModulePath = resolve(modulePath);
        const resolvedPluginDir = resolve(this.pluginDir);
        if (!resolvedModulePath.startsWith(resolvedPluginDir + sep)) {
            throw new PluginLoadError("LOAD_FAILED", `Entrypoint module escapes plugin directory: ${modulePath}`);
        }
        const entry = (await import(modulePath));
        const factory = entry[manifest.entrypoint.exportName];
        if (typeof factory !== "function") {
            throw new PluginLoadError("LOAD_FAILED", `Entrypoint export "${manifest.entrypoint.exportName}" is not a function`);
        }
        const instance = factory(manifest);
        return instance;
    }
}
function readManifest(path) {
    return JSON.parse(readFileSync(path, "utf8"));
}
//# sourceMappingURL=loader.js.map