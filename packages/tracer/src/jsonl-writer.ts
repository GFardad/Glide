import {
  existsSync,
  renameSync,
  unlinkSync,
  readFileSync,
  statSync,
  fsyncSync,
  mkdirSync,
  openSync,
  writeSync,
  closeSync,
  writeFileSync,
  constants,
} from "node:fs";
import { join } from "node:path";

export interface JsonlWriterOptions {
  rootDir?: string | undefined;
  fileName?: string | undefined;
  maxBytes?: number | undefined;
  maxFiles?: number | undefined;
  /** Durability batching: fsync at most every N appends (default 1 = every append). */
  fsyncEvery?: number | undefined;
}

export interface JsonlWriteOptions {
  id?: string;
  timestamp?: string;
}

export interface JsonlRecord {
  _seq?: number;
  _ts?: string;
  id?: string;
  [key: string]: unknown;
}

/**
 * Append-only JSONL log with size-based rotation.
 *
 * Uses a single persistent file descriptor for appends (avoiding the
 * open/close + duplicate write syscall on every record) while retaining
 * configurable fsync durability. This removes the dominant per-record
 * overhead in the critical path (see audit-perf #3).
 */
export class JsonlWriter {
  private readonly rootDir: string;
  private readonly filePath: string;
  private readonly maxBytes: number;
  private readonly maxFiles: number;
  private readonly fsyncEvery: number;
  private nextSequence = 0;
  private appendsSinceFsync = 0;
  private fd: number | null = null;

  constructor(options: JsonlWriterOptions = {}) {
    this.rootDir = options.rootDir ?? ".glide-sessions";
    this.filePath = join(this.rootDir, options.fileName ?? "events.jsonl");
    this.maxBytes = options.maxBytes ?? 5 * 1024 * 1024;
    this.maxFiles = options.maxFiles ?? 5;
    this.fsyncEvery = options.fsyncEvery ?? 1;
  }

  append(record: JsonlRecord): void {
    const payload = {
      _seq: this.nextSequence++,
      _ts: record._ts ?? new Date().toISOString(),
      ...record,
    };

    const json = JSON.stringify(payload);
    if (json.length >= this.maxBytes) {
      throw new Error(
        `Record size ${json.length} exceeds max log line size ${this.maxBytes}`
      );
    }

    this.rotateIfNeeded();
    this.ensureOpen();

    const buf = Buffer.from(`${json}\n`, "utf8");
    let written = 0;
    while (written < buf.length) {
      written += writeSync(this.fd as number, buf, written, buf.length - written);
    }

    this.appendsSinceFsync += 1;
    if (this.fsyncEvery <= 0 || this.appendsSinceFsync >= this.fsyncEvery) {
      this.fsync();
      this.appendsSinceFsync = 0;
    }
  }

  readAll<T extends JsonlRecord = JsonlRecord>(): T[] {
    if (!existsSync(this.filePath)) {
      return [];
    }

    const raw = readFileSync(this.filePath, "utf8");
    const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const records: T[] = [];
    let malformed = 0;
    let firstBadLine: string | undefined;
    for (const line of lines) {
      try {
        records.push(JSON.parse(line) as T);
      } catch {
        malformed += 1;
        if (firstBadLine === undefined) {
          firstBadLine = line.slice(0, 200);
        }
      }
    }
    if (malformed > 0) {
      console.error(
        `[jsonl-writer] ${this.filePath}: skipped ${malformed} malformed line(s); first=${JSON.stringify(firstBadLine)}`
      );
    }
    return records;
  }

  clear(): void {
    this.closeFd();
    if (existsSync(this.filePath)) {
      writeFileSync(this.filePath, "", "utf8");
    }
    this.nextSequence = 0;
    this.appendsSinceFsync = 0;
  }

  /** Flush and close the underlying descriptor. No-op if already closed. */
  close(): void {
    this.fsync();
    this.closeFd();
  }

  private ensureDirectory(): void {
    mkdirSync(this.rootDir, { recursive: true });
  }

  private ensureOpen(): void {
    this.ensureDirectory();
    if (this.fd !== null) {
      return;
    }
    this.fd = openSync(this.filePath, constants.O_CREAT | constants.O_RDWR | constants.O_APPEND, 0o644);
  }

  private fsync(): void {
    if (this.fd === null) {
      return;
    }
    try {
      fsyncSync(this.fd);
    } catch {
      // best-effort fsync
    }
  }

  private closeFd(): void {
    if (this.fd === null) {
      return;
    }
    try {
      closeSync(this.fd);
    } catch {
      // best-effort close
    }
    this.fd = null;
  }

  private rotateIfNeeded(): void {
    try {
      this.ensureDirectory();
      if (!existsSync(this.filePath)) {
        return;
      }

      const fileStat = statSync(this.filePath);
      if (fileStat.size < this.maxBytes) {
        return;
      }

      // Flush any buffered bytes before the fd no longer matches the renamed file.
      this.fsync();
      this.closeFd();

      const rotatedBase = `${this.filePath}.`;
      for (let index = this.maxFiles - 1; index >= 1; index--) {
        const source = `${rotatedBase}${index - 1}`;
        const target = `${rotatedBase}${index}`;
        if (existsSync(target)) {
          unlinkSync(target);
        }
        if (existsSync(source)) {
          renameSync(source, target);
        }
      }

      if (existsSync(this.filePath)) {
        renameSync(this.filePath, `${rotatedBase}0`);
      }

      // Preserve sequence monotonicity across rotations so replayed events
      // remain strictly ordered after a rename.
    } catch {
      // best-effort rotation
    }
  }
}
