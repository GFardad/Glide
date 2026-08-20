export { ExamplePluginLoader } from "./loader.js";
export type { ExamplePluginLoaderOptions } from "./loader.js";
import type { PluginDescriptor, PluginInstance } from "@glide/plugin-api";
export type { PluginDescriptor, PluginInstance } from "@glide/plugin-api";
export interface ExamplePluginApi {
    describe(): string;
    run(input: string): {
        ok: boolean;
        output: string;
    };
}
/**
 * Example plugin entrypoint. The loader resolves this module and calls the
 * named export with the plugin descriptor, returning a PluginInstance.
 */
export declare function createExamplePlugin(descriptor: PluginDescriptor): PluginInstance;
export default createExamplePlugin;
//# sourceMappingURL=index.d.ts.map