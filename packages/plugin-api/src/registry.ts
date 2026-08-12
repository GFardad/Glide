import type { PluginDescriptor, PluginInstance } from "./types.js";
import { PluginLoadError } from "./types.js";

export type RegistryEntry = {
  descriptor: PluginDescriptor;
  instance: PluginInstance;
  resourceLimits?: {
    maxMemoryMb?: number;
    maxCpuPercent?: number;
    timeoutMs?: number;
  };
};

export interface RegistryOptions {
  enforcePermissions?: boolean;
  enforceResourceLimits?: boolean;
}

export class MCPPluginRegistry {
  private entries = new Map<string, RegistryEntry>();
  private readonly enforcePermissions: boolean;
  private readonly enforceResourceLimitsFlag: boolean;

  constructor(options: RegistryOptions = {}) {
    this.enforcePermissions = options.enforcePermissions ?? false;
    this.enforceResourceLimitsFlag = options.enforceResourceLimits ?? false;
  }

  register(descriptor: PluginDescriptor): PluginInstance {
    if (this.entries.has(descriptor.id)) {
      throw new PluginLoadError(
        "DUPLICATE_ID",
        `Plugin with id "${descriptor.id}" is already registered`,
        descriptor
      );
    }

    const permissions = descriptor.manifest?.permissions;
    if (this.enforcePermissions && permissions) {
      const denied = Object.entries(permissions)
        .filter(([, allowed]) => allowed === false)
        .map(([capability]) => capability);
      if (denied.length > 0) {
        throw new PluginLoadError(
          "PERMISSION_DENIED",
          `Plugin "${descriptor.id}" denies required capabilities: ${denied.join(", ")}`,
          descriptor
        );
      }
    }

    const resourceLimits = descriptor.manifest?.resourceLimits;
    if (this.enforceResourceLimitsFlag && resourceLimits) {
      if (
        resourceLimits.maxMemoryMb !== undefined &&
        resourceLimits.maxMemoryMb <= 0
      ) {
        throw new PluginLoadError(
          "RESOURCE_LIMIT_EXCEEDED",
          `Plugin "${descriptor.id}" declares invalid maxMemoryMb: ${resourceLimits.maxMemoryMb}`,
          descriptor
        );
      }
      if (
        resourceLimits.maxCpuPercent !== undefined &&
        (resourceLimits.maxCpuPercent <= 0 || resourceLimits.maxCpuPercent > 100)
      ) {
        throw new PluginLoadError(
          "RESOURCE_LIMIT_EXCEEDED",
          `Plugin "${descriptor.id}" declares invalid maxCpuPercent: ${resourceLimits.maxCpuPercent}`,
          descriptor
        );
      }
      if (
        resourceLimits.timeoutMs !== undefined &&
        resourceLimits.timeoutMs <= 0
      ) {
        throw new PluginLoadError(
          "RESOURCE_LIMIT_EXCEEDED",
          `Plugin "${descriptor.id}" declares invalid timeoutMs: ${resourceLimits.timeoutMs}`,
          descriptor
        );
      }
    }

    const instance: PluginInstance = {
      descriptor,
      loadedAt: new Date(),
    };

    this.entries.set(
      descriptor.id,
      resourceLimits
        ? { descriptor, instance, resourceLimits }
        : { descriptor, instance }
    );
    return instance;
  }

  list(): PluginInstance[] {
    return Array.from(this.entries.values()).map((entry) => entry.instance);
  }

  load(id: string): PluginInstance {
    const entry = this.entries.get(id);
    if (!entry) {
      throw new PluginLoadError(
        "NOT_FOUND",
        `Plugin with id "${id}" not found`
      );
    }
    return entry.instance;
  }

  unregister(id: string): boolean {
    return this.entries.delete(id);
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  enforceResourceLimits(id: string): void {
    const entry = this.entries.get(id);
    if (!entry || !entry.resourceLimits) {
      return;
    }

    const limits = entry.resourceLimits;
    if (limits.timeoutMs !== undefined) {
      const start = Date.now();
      const checkInterval = setInterval(() => {
        if (Date.now() - start > limits.timeoutMs!) {
          clearInterval(checkInterval);
          throw new PluginLoadError(
            "RESOURCE_LIMIT_EXCEEDED",
            `Plugin "${id}" exceeded timeout limit of ${limits.timeoutMs}ms`
          );
        }
      }, 100);
    }

    if (limits.maxMemoryMb !== undefined || limits.maxCpuPercent !== undefined) {
      try {
        const usage = process.memoryUsage();
        const heapUsedMb = usage.heapUsed / (1024 * 1024);
        if (limits.maxMemoryMb !== undefined && heapUsedMb > limits.maxMemoryMb) {
          throw new PluginLoadError(
            "RESOURCE_LIMIT_EXCEEDED",
            `Plugin "${id}" exceeded memory limit of ${limits.maxMemoryMb}MB (current: ${heapUsedMb.toFixed(2)}MB)`
          );
        }
      } catch (error) {
        if (error instanceof PluginLoadError) {
          throw error;
        }
      }
    }
  }

  getResourceLimits(id: string) {
    const entry = this.entries.get(id);
    return entry?.resourceLimits;
  }
}
