import type { PluginInstance } from "./types.ts";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { appendFile } from "node:fs/promises";

export interface SessionDurabilityOptions {
  rootDir?: string;
  eventFile?: string;
  extension?: string;
}

export interface SessionDurabilityEvent {
  type: "state_persisted" | "state_restored" | "state_removed" | "state_cleared";
  pluginId: string;
  timestamp: string;
  size?: number;
}

export class PrimeAgentSessionDurability {
  private readonly stateDir: string;
  private readonly eventFile: string;
  private readonly extension: string;

  constructor(options: SessionDurabilityOptions = {}) {
    this.stateDir = options.rootDir ?? ".glide-plugin-state";
    this.eventFile = options.eventFile ?? join(this.stateDir, "session-events.jsonl");
    this.extension = options.extension ?? ".json";
  }

  private filePath(pluginId: string): string {
    return join(this.stateDir, `${pluginId}${this.extension}`);
  }

  async persist(instance: PluginInstance): Promise<void> {
    if (!instance.descriptor.sessionDurable) {
      return;
    }

    if (!existsSync(this.stateDir)) {
      mkdirSync(this.stateDir, { recursive: true });
    }

    const state = JSON.stringify(instance.state ?? {});
    const file = this.filePath(instance.descriptor.id);
    writeFileSync(file, state, "utf8");

    await this.appendEvent({
      type: "state_persisted",
      pluginId: instance.descriptor.id,
      timestamp: new Date().toISOString(),
      size: new TextEncoder().encode(state).length,
    });
  }

  async restore(pluginId: string): Promise<Record<string, unknown> | undefined> {
    const file = this.filePath(pluginId);
    if (!existsSync(file)) {
      return undefined;
    }

    const raw = readFileSync(file, "utf8");
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return undefined;
    }

    if (payload.id !== undefined && (payload.id as string) !== pluginId) {
      return undefined;
    }

    const state = (payload.state ?? payload) as Record<string, unknown>;

    await this.appendEvent({
      type: "state_restored",
      pluginId,
      timestamp: new Date().toISOString(),
    });

    return state;
  }

  async remove(pluginId: string): Promise<boolean> {
    const file = this.filePath(pluginId);
    if (!existsSync(file)) {
      return false;
    }

    rmSync(file);

    await this.appendEvent({
      type: "state_removed",
      pluginId,
      timestamp: new Date().toISOString(),
    });

    return true;
  }

  async clear(): Promise<void> {
    if (!existsSync(this.stateDir)) {
      mkdirSync(this.stateDir, { recursive: true });
    }

    let files: string[] = [];
    try {
      files = readFileSync(this.eventFile, "utf8")
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as SessionDurabilityEvent)
        .filter((event) => event.type === "state_persisted")
        .map((event) => this.filePath(event.pluginId));
    } catch {
      // Event file missing or corrupt — nothing to clear.
    }

    for (const file of files) {
      if (existsSync(file)) {
        rmSync(file);
      }
    }

    // Reset the event stream before recording the clear event.
    try {
      writeFileSync(this.eventFile, "", "utf8");
    } catch {
      // Ignore if event file doesn't exist.
    }

    await this.appendEvent({
      type: "state_cleared",
      pluginId: "*",
      timestamp: new Date().toISOString(),
    });
  }

  async readEvents(): Promise<SessionDurabilityEvent[]> {
    if (!existsSync(this.eventFile)) {
      return [];
    }

    const raw = readFileSync(this.eventFile, "utf8");
    const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
    return lines.map((line) => JSON.parse(line) as SessionDurabilityEvent);
  }

  private async appendEvent(event: SessionDurabilityEvent): Promise<void> {
    await appendFile(this.eventFile, JSON.stringify(event) + "\n", "utf8");
  }
}
