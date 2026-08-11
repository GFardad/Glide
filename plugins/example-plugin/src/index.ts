export { ExamplePluginLoader } from "./loader.js";
export type { ExamplePluginLoaderOptions } from "./loader.js";
import type { PluginDescriptor, PluginInstance } from "@glide/plugin-api";
export type { PluginDescriptor, PluginInstance } from "@glide/plugin-api";

export interface ExamplePluginApi {
  describe(): string;
  run(input: string): { ok: boolean; output: string };
}

/**
 * Example plugin entrypoint. The loader resolves this module and calls the
 * named export with the plugin descriptor, returning a PluginInstance.
 */
export function createExamplePlugin(
  descriptor: PluginDescriptor
): PluginInstance {
  const api: ExamplePluginApi = {
    describe(): string {
      return `${descriptor.name}@${descriptor.version} (${descriptor.kind})`;
    },
    run(input: string): { ok: boolean; output: string } {
      return { ok: true, output: `echo: ${input}` };
    },
  };

  return {
    descriptor,
    loadedAt: new Date(),
    state: { api },
  };
}

export default createExamplePlugin;
