import { z } from "zod";
import { MinimalPluginManifestSchema } from "./manifest.js";
export { MinimalPluginManifestSchema, validatePluginManifest } from "./manifest.js";
export { resolveRegistryPath, loadRegistry, saveRegistry, registerPlugin, listPlugins, } from "./loader.js";
export const PluginRegistrySchema = z.object({
    plugins: z.array(MinimalPluginManifestSchema),
});
//# sourceMappingURL=index.js.map