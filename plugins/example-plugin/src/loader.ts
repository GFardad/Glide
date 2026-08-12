import { readFileSync, existsSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import type {
  IPluginLoader,
  PluginDescriptor,
  PluginInstance,
} from "@glide/plugin-api";
import { PluginLoadError } from "@glide/plugin-api";

export interface ExamplePluginLoaderOptions {
  /** Directory containing plugin.json and the entrypoint module. */
  pluginDir: string;
}

/**
 * Loader for the example plugin. Reads plugin.json as the PluginDescriptor,
 * dynamically imports the entrypoint module, and instantiates the plugin by
 * calling the configured export name.
 */
export class ExamplePluginLoader implements IPluginLoader {
  private pluginDir: string;

  constructor(options: ExamplePluginLoaderOptions) {
    this.pluginDir = options.pluginDir;
  }

  async resolve(descriptor: PluginDescriptor): Promise<boolean> {
    const manifestPath = join(this.pluginDir, "plugin.json");
    if (!existsSync(manifestPath)) {
      throw new PluginLoadError(
        "NOT_FOUND",
        `Manifest not found: ${manifestPath}`
      );
    }
    return descriptor.id === readManifest(manifestPath).id;
  }

  async load(descriptor: PluginDescriptor): Promise<PluginInstance> {
    const manifestPath = join(this.pluginDir, "plugin.json");
    if (!existsSync(manifestPath)) {
      throw new PluginLoadError(
        "NOT_FOUND",
        `Manifest not found: ${manifestPath}`
      );
    }

    const manifest = readManifest(manifestPath);
    if (manifest.id !== descriptor.id) {
      throw new PluginLoadError(
        "INVALID_MANIFEST",
        `Descriptor id "${descriptor.id}" does not match manifest id "${manifest.id}"`
      );
    }

    const modulePath = join(this.pluginDir, manifest.entrypoint.module);
    if (!existsSync(modulePath)) {
      throw new PluginLoadError(
        "LOAD_FAILED",
        `Entrypoint module not found: ${modulePath}`
      );
    }

    const resolvedModulePath = resolve(modulePath);
    const resolvedPluginDir = resolve(this.pluginDir);
    if (!resolvedModulePath.startsWith(resolvedPluginDir + sep)) {
      throw new PluginLoadError(
        "LOAD_FAILED",
        `Entrypoint module escapes plugin directory: ${modulePath}`
      );
    }

    const entry = (await import(modulePath)) as Record<string, unknown>;
    const factory = entry[manifest.entrypoint.exportName];
    if (typeof factory !== "function") {
      throw new PluginLoadError(
        "LOAD_FAILED",
        `Entrypoint export "${manifest.entrypoint.exportName}" is not a function`
      );
    }

    const instance = (factory as (d: PluginDescriptor) => PluginInstance)(
      manifest
    );
    return instance;
  }
}

function readManifest(path: string): PluginDescriptor {
  return JSON.parse(readFileSync(path, "utf8")) as PluginDescriptor;
}
