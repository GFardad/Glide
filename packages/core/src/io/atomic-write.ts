import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, openSync, closeSync, fsyncSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Synchronously write content to a file atomically using temp-file + rename.
 * The write includes fsync on the file descriptor and rename fsync to ensure
 * durability across crashes and power loss.
 */
export function atomicWriteFileSync(filePath: string, content: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    const fd = openSync(tempPath, "w");
    try {
      writeFileSync(tempPath, content, "utf8");
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(tempPath, filePath);

    // fsync the directory to persist the rename metadata
    const dirFd = openSync(dir, "r");
    try {
      fsyncSync(dirFd);
    } finally {
      closeSync(dirFd);
    }
  } catch (error) {
    try {
      if (existsSync(tempPath)) unlinkSync(tempPath);
    } catch {
      // best-effort cleanup
    }
    throw error;
  }
}

/**
 * Synchronously append a line to a JSONL file with durability guarantees.
 * Uses temp file + rename for the append operation to prevent partial writes.
 * On high-throughput paths, consider using the async JsonlWriter instead.
 */
export function atomicAppendFileSync(filePath: string, content: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    const existing = existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
    const fd = openSync(tempPath, "w");
    try {
      writeFileSync(tempPath, `${existing}${content}\n`, "utf8");
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(tempPath, filePath);

    const dirFd = openSync(dir, "r");
    try {
      fsyncSync(dirFd);
    } finally {
      closeSync(dirFd);
    }
  } catch (error) {
    try {
      if (existsSync(tempPath)) unlinkSync(tempPath);
    } catch {
      // best-effort cleanup
    }
    throw error;
  }
}

/**
 * Reads a file safely, returning undefined if it does not exist.
 */
export function safeReadFileSync(filePath: string, encoding: "utf8" = "utf8"): string | undefined {
  try {
    return readFileSync(filePath, encoding);
  } catch {
    return undefined;
  }
}

/**
 * Sync a file descriptor to persistent storage.
 */
export function fsyncPath(filePath: string): void {
  const fd = openSync(filePath, "r");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}
