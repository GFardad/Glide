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
export declare class JsonlWriter {
    private readonly rootDir;
    private readonly filePath;
    private readonly maxBytes;
    private readonly maxFiles;
    private readonly fsyncEvery;
    private nextSequence;
    private appendsSinceFsync;
    private fd;
    constructor(options?: JsonlWriterOptions);
    append(record: JsonlRecord): void;
    readAll<T extends JsonlRecord = JsonlRecord>(): T[];
    clear(): void;
    /** Flush and close the underlying descriptor. No-op if already closed. */
    close(): void;
    private ensureDirectory;
    private ensureOpen;
    private fsync;
    private closeFd;
    private rotateIfNeeded;
}
//# sourceMappingURL=jsonl-writer.d.ts.map