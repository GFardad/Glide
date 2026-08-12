import type { PluginDescriptor, PluginInstance } from "./types.js";
import { PluginLoadError } from "./types.js";
import { z } from "zod";


const PluginManifestPermissionsSchema = z.object({
  network: z.boolean().optional(),
  filesystem: z.boolean().optional(),
  env: z.boolean().optional(),
  shell: z.boolean().optional(),
});

const PluginManifestResourceLimitsSchema = z.object({
  maxMemoryMb: z.number().int().positive().optional(),
  maxCpuPercent: z.number().positive().max(100).optional(),
  timeoutMs: z.number().int().positive().optional(),
});

const PluginManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
  author: z.string().optional(),
  homepage: z.string().url().optional().or(z.literal("")),
  mcpEndpoint: z.string().url().optional().or(z.literal("")),
  kind: z.enum(["mcp", "agent-hook", "skill"]),
  sessionDurable: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  entrypoint: z.object({
    module: z.string().min(1),
    exportName: z.string().min(1),
    stateSchema: z.record(z.unknown()).optional(),
  }),
  permissions: PluginManifestPermissionsSchema.optional(),
  resourceLimits: PluginManifestResourceLimitsSchema.optional(),
});

const PluginDescriptorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
  author: z.string().optional(),
  homepage: z.string().url().optional().or(z.literal("")),
  mcpEndpoint: z.string().url().optional().or(z.literal("")),
  kind: z.enum(["mcp", "agent-hook", "skill"]),
  sessionDurable: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  entrypoint: z.object({
    module: z.string().min(1),
    exportName: z.string().min(1),
    stateSchema: z.record(z.unknown()).optional(),
  }),
  manifest: z.any().optional(),
});

export interface ValidatedPluginDescriptor extends PluginDescriptor {
  validated: true;
}

export function validatePluginManifest(manifest: unknown): ValidatedPluginDescriptor {
  const parsed = PluginManifestSchema.safeParse(manifest);
  if (!parsed.success) {
    throw new PluginLoadError(
      "INVALID_MANIFEST",
      `Plugin manifest validation failed: ${parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`
    );
  }
  return { ...parsed.data, validated: true } as ValidatedPluginDescriptor;
}

export function validatePluginDescriptor(descriptor: PluginDescriptor): ValidatedPluginDescriptor {
  const parsed = PluginDescriptorSchema.safeParse(descriptor);
  if (!parsed.success) {
    throw new PluginLoadError(
      "INVALID_MANIFEST",
      `Plugin descriptor validation failed: ${parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`
    );
  }
  return { ...parsed.data, validated: true } as ValidatedPluginDescriptor;
}

/**
 * Contract for pluggable loaders. Implementations must return a PluginInstance
 * or throw PluginLoadError with a specific error code.
 */
export interface IPluginLoader {
  /**
   * Load a plugin from its descriptor. Implementations may perform module
   * resolution, manifest validation, or remote fetch depending on the kind.
   */
  load(descriptor: PluginDescriptor): Promise<PluginInstance>;

  /**
   * Preflight check: validate the descriptor and resolve the module without
   * fully instantiating the plugin.
   */
  resolve?(descriptor: PluginDescriptor): Promise<boolean>;
}

export interface PluginLoadOptions {
  allowedRoots?: string[];
}

export class PluginLoaderRegistry {
  private loaders = new Map<string, IPluginLoader>();

  register(kind: string, loader: IPluginLoader): void {
    if (this.loaders.has(kind)) {
      throw new PluginLoadError(
        "INVALID_MANIFEST",
        `Loader for kind "${kind}" already registered`
      );
    }
    this.loaders.set(kind, loader);
  }

  get(kind: string): IPluginLoader | undefined {
    return this.loaders.get(kind);
  }

  list(): string[] {
    return Array.from(this.loaders.keys());
  }
}

export function loadWithLoader(
  loader: IPluginLoader,
  descriptor: PluginDescriptor
): Promise<PluginInstance> {
  const validated = validatePluginDescriptor(descriptor);
  return loader.load(validated).catch((cause) => {
    const code = cause instanceof PluginLoadError ? cause.code : "LOAD_FAILED";
    throw new PluginLoadError(
      code,
      `Failed to load plugin "${descriptor.id}"`,
      cause
    );
  });
}
