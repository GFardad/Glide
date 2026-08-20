import { z } from "zod";
export declare const MinimalPluginManifestSchema: z.ZodObject<{
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
}>;
export type MinimalPluginManifest = z.infer<typeof MinimalPluginManifestSchema>;
export interface ManifestValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
export declare function validatePluginManifest(input: unknown): ManifestValidationResult;
//# sourceMappingURL=manifest.d.ts.map