import type { PluginDescriptor, PluginInstance } from "./types.js";
import { PluginLoadError } from "./types.js";

/**
 * Contract for pluggable loaders. Implementations must return a PluginInstance
 * or throw PluginLoadError with a specific error code.
 */
export interface IPluginLoader {
  /**
   * Load a plugin from its descriptor. Implementations may perform module
   * resolution, manifest validation, or remote fetch depending on the kind.
   */
  load(descriptor: PluginDescriptor): Promise<PluginInstance>;

  /**
   * Preflight check: validate the descriptor and resolve the module without
   * fully instantiating the plugin.
   */
  resolve?(descriptor: PluginDescriptor): Promise<boolean>;
}

export class PluginLoaderRegistry {
  private loaders = new Map<string, IPluginLoader>();

  register(kind: string, loader: IPluginLoader): void {
    if (this.loaders.has(kind)) {
      throw new PluginLoadError(
        "INVALID_MANIFEST",
        `Loader for kind "${kind}" already registered`
      );
    }
    this.loaders.set(kind, loader);
  }

  get(kind: string): IPluginLoader | undefined {
    return this.loaders.get(kind);
  }

  list(): string[] {
    return Array.from(this.loaders.keys());
  }
}

export function loadWithLoader(
  loader: IPluginLoader,
  descriptor: PluginDescriptor
): Promise<PluginInstance> {
  return loader.load(descriptor).catch((cause) => {
    const code = cause instanceof PluginLoadError ? cause.code : "LOAD_FAILED";
    throw new PluginLoadError(
      code,
      `Failed to load plugin "${descriptor.id}"`,
      cause
    );
  });
}
