import type { MinimalPluginManifest } from "./manifest.js";
export interface PluginRegistry {
    plugins: MinimalPluginManifest[];
}
export interface PluginLoaderOptions {
    root: string;
    filename?: string;
}
export declare function resolveRegistryPath(options: PluginLoaderOptions): string;
export declare function loadRegistry(options: PluginLoaderOptions): PluginRegistry;
export declare function saveRegistry(options: PluginLoaderOptions, registry: PluginRegistry): void;
export declare function registerPlugin(options: PluginLoaderOptions, manifest: MinimalPluginManifest): PluginRegistry;
export declare function listPlugins(options: PluginLoaderOptions): MinimalPluginManifest[];
//# sourceMappingURL=loader.d.ts.map