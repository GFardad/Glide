import type {
  PluginDescriptor,
  PluginInstance,
  PluginLoadError,
} from "./types.js";

export type { PluginLoadError } from "./types.js";

/**
 * Extension points are named hooks provided by a plugin that other plugins
 * can consume. Think of them as public API surfaces within a plugin.
 */
export interface ExtensionPointDescriptor {
  id: string;
  name: string;
  description?: string;
  schema?: Record<string, unknown>;
}

/**
 * Hook contributed by a plugin into an extension point.
 */
export interface ExtensionHook {
  extensionPointId: string;
  pluginId: string;
}

/**
 * Presets describe template overrides and shared terminology that can be
 * applied across a set of plugins in a bundle.
 */
export interface PresetDescriptor {
  id: string;
  name: string;
  description?: string;
  template?: string;
  terminology?: Record<string, string>;
}

/**
 * Reference to a plugin inside a bundle. Allows overriding descriptor fields
 * without rewriting the entire plugin definition.
 */
export interface PluginReference {
  id: string;
  kind: PluginDescriptor["kind"];
  overrides?: Partial<PluginDescriptor>;
}

/**
 * Bundles group plugins into role-based stacks. A bundle can extend other
 * bundles, inherit their roles, and add its own presets.
 */
export interface BundleDescriptor {
  id: string;
  name: string;
  description?: string;
  version?: string;
  extends?: string[];
  roles?: Record<string, PluginReference[]>;
  defaults?: Record<string, unknown>;
  presets?: string[];
}

export interface ComposedPlugin {
  descriptor: PluginDescriptor;
  role: string;
  preset?: PresetDescriptor;
  extensionPoints: ExtensionPointDescriptor[];
}

export class CompositionError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "DUPLICATE_ID" | "INVALID_COMPOSITION",
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "CompositionError";
  }
}

export class CompositionRegistry {
  private extensionPoints = new Map<string, ExtensionPointDescriptor>();
  private presets = new Map<string, PresetDescriptor>();
  private bundles = new Map<string, BundleDescriptor>();

  registerExtensionPoint(descriptor: ExtensionPointDescriptor): void {
    if (this.extensionPoints.has(descriptor.id)) {
      throw new CompositionError(
        "DUPLICATE_ID",
        `Extension point "${descriptor.id}" is already registered`
      );
    }

    this.extensionPoints.set(descriptor.id, descriptor);
  }

  registerPreset(descriptor: PresetDescriptor): void {
    if (this.presets.has(descriptor.id)) {
      throw new CompositionError(
        "DUPLICATE_ID",
        `Preset "${descriptor.id}" is already registered`
      );
    }

    this.presets.set(descriptor.id, descriptor);
  }

  registerBundle(descriptor: BundleDescriptor): void {
    if (this.bundles.has(descriptor.id)) {
      throw new CompositionError(
        "DUPLICATE_ID",
        `Bundle "${descriptor.id}" is already registered`
      );
    }

    this.bundles.set(descriptor.id, descriptor);
  }

  listExtensionPoints(): ExtensionPointDescriptor[] {
    return Array.from(this.extensionPoints.values());
  }

  listPresets(): PresetDescriptor[] {
    return Array.from(this.presets.values());
  }

  listBundles(): BundleDescriptor[] {
    return Array.from(this.bundles.values());
  }

  getExtensionPoint(id: string): ExtensionPointDescriptor | undefined {
    return this.extensionPoints.get(id);
  }

  getPreset(id: string): PresetDescriptor | undefined {
    return this.presets.get(id);
  }

  getBundle(id: string): BundleDescriptor | undefined {
    return this.bundles.get(id);
  }

  composeBundle(
    bundleId: string,
    pluginRegistry: {
      load: (id: string) => PluginInstance;
      has: (id: string) => boolean;
    }
  ): ComposedPlugin[] {
    const bundle = this.bundles.get(bundleId);
    if (!bundle) {
      throw new CompositionError(
        "NOT_FOUND",
        `Bundle "${bundleId}" not found`
      );
    }

    const mergedRoles = new Map<string, PluginReference[]>();
    const mergedPresetIds = new Set<string>(bundle.presets ?? []);
    let mergedDefaults: Record<string, unknown> = { ...bundle.defaults };

    for (const parentId of bundle.extends ?? []) {
      const parent = this.bundles.get(parentId);
      if (!parent) {
        throw new CompositionError(
          "NOT_FOUND",
          `Parent bundle "${parentId}" not found`
        );
      }

      for (const [role, refs] of Object.entries(parent.roles ?? {})) {
        const existing = mergedRoles.get(role) ?? [];
        mergedRoles.set(role, [...existing, ...refs]);
      }

      (parent.presets ?? []).forEach((id) => mergedPresetIds.add(id));
      mergedDefaults = { ...mergedDefaults, ...parent.defaults };
    }

    for (const [role, refs] of Object.entries(bundle.roles ?? {})) {
      const existing = mergedRoles.get(role) ?? [];
      mergedRoles.set(role, [...existing, ...refs]);
    }

    const composed: ComposedPlugin[] = [];

    mergedRoles.forEach((refs, role) => {
      for (const reference of refs) {
        if (!pluginRegistry.has(reference.id)) {
          throw new CompositionError(
            "NOT_FOUND",
            `Plugin "${reference.id}" referenced by bundle "${bundleId}" is not registered`
          );
        }

        const instance = pluginRegistry.load(reference.id);
        const descriptor: PluginDescriptor = {
          ...instance.descriptor,
          ...reference.overrides,
          ...mergedDefaults,
        } as PluginDescriptor;

        const preset = Array.from(mergedPresetIds)
          .map((id) => this.presets.get(id))
          .find((preset): preset is PresetDescriptor => preset !== undefined);

        composed.push({
          descriptor,
          role,
          ...(preset ? { preset } : {}),
          extensionPoints: this.resolveExtensionPointsForPlugin(reference.id),
        });
      }
    });

    return composed;
  }

  private resolveExtensionPointsForPlugin(
    pluginId: string
  ): ExtensionPointDescriptor[] {
    const result: ExtensionPointDescriptor[] = [];

    this.extensionPoints.forEach((extensionPoint) => {
      if (extensionPoint.id.startsWith(`${pluginId}.`)) {
        result.push(extensionPoint);
      }
    });

    return result;
  }
}
