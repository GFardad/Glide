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
export declare function resolveRegistryPath(root: string): string;
export declare function loadRegistry(root: string): PluginRegistry;
export declare function saveRegistry(root: string, registry: PluginRegistry): void;
export declare function registerPlugin(root: string, manifest: PluginManifest): PluginRegistry;
export declare function listPlugins(root: string): PluginManifest[];
//# sourceMappingURL=plugin-registry.d.ts.map