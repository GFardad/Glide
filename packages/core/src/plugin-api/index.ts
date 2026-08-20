import { z } from "zod";
import { MinimalPluginManifestSchema } from "./manifest.js";
export { MinimalPluginManifestSchema, MinimalPluginManifest, validatePluginManifest, ManifestValidationResult } from "./manifest.js";
export {
  PluginRegistry,
  PluginLoaderOptions,
  resolveRegistryPath,
  loadRegistry,
  saveRegistry,
  registerPlugin,
  listPlugins,
} from "./loader.js";

export const PluginRegistrySchema = z.object({
  plugins: z.array(MinimalPluginManifestSchema),
});

export type PluginRegistryShape = z.infer<typeof PluginRegistrySchema>;
