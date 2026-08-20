import { z } from "zod";
export { MinimalPluginManifestSchema, MinimalPluginManifest, validatePluginManifest, ManifestValidationResult } from "./manifest.js";
export { PluginRegistry, PluginLoaderOptions, resolveRegistryPath, loadRegistry, saveRegistry, registerPlugin, listPlugins, } from "./loader.js";
export declare const PluginRegistrySchema: z.ZodObject<{
    plugins: z.ZodArray<z.ZodObject<{
        id: z.ZodEffects<z.ZodString, string, string>;
        name: z.ZodEffects<z.ZodString, string, string>;
        version: z.ZodEffects<z.ZodString, string, string>;
        description: z.ZodOptional<z.ZodString>;
        entrypoint: z.ZodOptional<z.ZodString>;
        capabilities: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        permissions: z.ZodOptional<z.ZodObject<{
            filesystem: z.ZodOptional<z.ZodEnum<["read", "write", "none"]>>;
            network: z.ZodOptional<z.ZodBoolean>;
            exec: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            filesystem?: "none" | "read" | "write" | undefined;
            network?: boolean | undefined;
            exec?: boolean | undefined;
        }, {
            filesystem?: "none" | "read" | "write" | undefined;
            network?: boolean | undefined;
            exec?: boolean | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        version: string;
        description?: string | undefined;
        entrypoint?: string | undefined;
        capabilities?: string[] | undefined;
        permissions?: {
            filesystem?: "none" | "read" | "write" | undefined;
            network?: boolean | undefined;
            exec?: boolean | undefined;
        } | undefined;
    }, {
        id: string;
        name: string;
        version: string;
        description?: string | undefined;
        entrypoint?: string | undefined;
        capabilities?: string[] | undefined;
        permissions?: {
            filesystem?: "none" | "read" | "write" | undefined;
            network?: boolean | undefined;
            exec?: boolean | undefined;
        } | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    plugins: {
        id: string;
        name: string;
        version: string;
        description?: string | undefined;
        entrypoint?: string | undefined;
        capabilities?: string[] | undefined;
        permissions?: {
            filesystem?: "none" | "read" | "write" | undefined;
            network?: boolean | undefined;
            exec?: boolean | undefined;
        } | undefined;
    }[];
}, {
    plugins: {
        id: string;
        name: string;
        version: string;
        description?: string | undefined;
        entrypoint?: string | undefined;
        capabilities?: string[] | undefined;
        permissions?: {
            filesystem?: "none" | "read" | "write" | undefined;
            network?: boolean | undefined;
            exec?: boolean | undefined;
        } | undefined;
    }[];
}>;
export type PluginRegistryShape = z.infer<typeof PluginRegistrySchema>;
//# sourceMappingURL=index.d.ts.map