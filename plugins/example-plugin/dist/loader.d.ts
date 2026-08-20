import type { IPluginLoader, PluginDescriptor, PluginInstance } from "@glide/plugin-api";
export interface ExamplePluginLoaderOptions {
    /** Directory containing plugin.json and the entrypoint module. */
    pluginDir: string;
}
/**
 * Loader for the example plugin. Reads plugin.json as the PluginDescriptor,
 * dynamically imports the entrypoint module, and instantiates the plugin by
 * calling the configured export name.
 */
export declare class ExamplePluginLoader implements IPluginLoader {
    private pluginDir;
    constructor(options: ExamplePluginLoaderOptions);
    resolve(descriptor: PluginDescriptor): Promise<boolean>;
    load(descriptor: PluginDescriptor): Promise<PluginInstance>;
}
//# sourceMappingURL=loader.d.ts.map