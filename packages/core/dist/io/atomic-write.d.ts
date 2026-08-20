/**
 * Synchronously write content to a file atomically using temp-file + rename.
 * The write includes fsync on the file descriptor and rename fsync to ensure
 * durability across crashes and power loss.
 */
export declare function atomicWriteFileSync(filePath: string, content: string): void;
/**
 * Synchronously append a line to a JSONL file with durability guarantees.
 * Uses temp file + rename for the append operation to prevent partial writes.
 * On high-throughput paths, consider using the async JsonlWriter instead.
 */
export declare function atomicAppendFileSync(filePath: string, content: string): void;
/**
 * Reads a file safely, returning undefined if it does not exist.
 */
export declare function safeReadFileSync(filePath: string, encoding?: "utf8"): string | undefined;
/**
 * Sync a file descriptor to persistent storage.
 */
export declare function fsyncPath(filePath: string): void;
//# sourceMappingURL=atomic-write.d.ts.map