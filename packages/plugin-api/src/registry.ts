import type { PluginDescriptor, PluginInstance } from "./types.js";
import { PluginLoadError } from "./types.js";

export type RegistryEntry = {
  descriptor: PluginDescriptor;
  instance: PluginInstance;
};

export class MCPPluginRegistry {
  private entries = new Map<string, RegistryEntry>();

  register(descriptor: PluginDescriptor): PluginInstance {
    if (this.entries.has(descriptor.id)) {
      throw new PluginLoadError(
        "DUPLICATE_ID",
        `Plugin with id "${descriptor.id}" is already registered`,
        descriptor
      );
    }

    const instance: PluginInstance = {
      descriptor,
      loadedAt: new Date(),
    };

    this.entries.set(descriptor.id, { descriptor, instance });
    return instance;
  }

  list(): PluginInstance[] {
    return Array.from(this.entries.values()).map((entry) => entry.instance);
  }

  load(id: string): PluginInstance {
    const entry = this.entries.get(id);
    if (!entry) {
      throw new PluginLoadError(
        "NOT_FOUND",
        `Plugin with id "${id}" not found`
      );
    }
    return entry.instance;
  }

  unregister(id: string): boolean {
    return this.entries.delete(id);
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }
}
