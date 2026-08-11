export interface PluginDescriptor {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  homepage?: string;
  mcpEndpoint?: string;
  kind: "mcp" | "agent-hook" | "skill";
  sessionDurable?: boolean;
  tags?: string[];
  entrypoint: PluginEntrypointDescriptor;
  /** @deprecated Preferred over passing a raw descriptor; keep for backwards compatibility */
  manifest?: PluginManifest;
}

export interface PluginEntrypointDescriptor {
  module: string;
  exportName: string;
  stateSchema?: Record<string, unknown>;
}

export interface PluginInstance {
  readonly descriptor: PluginDescriptor;
  readonly loadedAt: Date;
  state?: Record<string, unknown>;
}

export interface PluginManifestPermissions {
  network?: boolean;
  filesystem?: boolean;
  env?: boolean;
  shell?: boolean;
}

export interface PluginManifestResourceLimits {
  maxMemoryMb?: number;
  maxCpuPercent?: number;
  timeoutMs?: number;
}

export interface PluginManifest extends Required<Pick<PluginDescriptor, "id" | "name" | "version" | "kind">> {
  entrypoint: PluginEntrypointDescriptor;
  permissions?: PluginManifestPermissions;
  resourceLimits?: PluginManifestResourceLimits;
}

export type PluginLoadErrorCode =
  | "NOT_FOUND"
  | "INVALID_MANIFEST"
  | "LOAD_FAILED"
  | "DUPLICATE_ID"
  | "INVALID_MANIFEST_FIELD"
  | "RESOURCE_LIMIT_EXCEEDED"
  | "PERMISSION_DENIED";

export class PluginLoadError extends Error {
  constructor(
    public readonly code: PluginLoadErrorCode,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "PluginLoadError";
  }
}

export class PluginManifestValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "PluginManifestValidationError";
  }
}

export interface PluginManifestValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
