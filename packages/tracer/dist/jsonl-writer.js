import { existsSync, renameSync, unlinkSync, readFileSync, statSync, fsyncSync, mkdirSync, openSync, writeSync, closeSync, writeFileSync, constants, } from "node:fs";
import { join } from "node:path";
/**
 * Append-only JSONL log with size-based rotation.
 *
 * Uses a single persistent file descriptor for appends (avoiding the
 * open/close + duplicate write syscall on every record) while retaining
 * configurable fsync durability. This removes the dominant per-record
 * overhead in the critical path (see audit-perf #3).
 */
export class JsonlWriter {
    rootDir;
    filePath;
    maxBytes;
    maxFiles;
    fsyncEvery;
    nextSequence = 0;
    appendsSinceFsync = 0;
    fd = null;
    constructor(options = {}) {
        this.rootDir = options.rootDir ?? ".glide-sessions";
        this.filePath = join(this.rootDir, options.fileName ?? "events.jsonl");
        this.maxBytes = options.maxBytes ?? 5 * 1024 * 1024;
        this.maxFiles = options.maxFiles ?? 5;
        this.fsyncEvery = options.fsyncEvery ?? 1;
    }
    append(record) {
        const payload = {
            _seq: this.nextSequence++,
            _ts: record._ts ?? new Date().toISOString(),
            ...record,
        };
        const json = JSON.stringify(payload);
        if (json.length >= this.maxBytes) {
            throw new Error(`Record size ${json.length} exceeds max log line size ${this.maxBytes}`);
        }
        this.rotateIfNeeded();
        this.ensureOpen();
        const buf = Buffer.from(`${json}\n`, "utf8");
        let written = 0;
        while (written < buf.length) {
            written += writeSync(this.fd, buf, written, buf.length - written);
        }
        this.appendsSinceFsync += 1;
        if (this.fsyncEvery <= 0 || this.appendsSinceFsync >= this.fsyncEvery) {
            this.fsync();
            this.appendsSinceFsync = 0;
        }
    }
    readAll() {
        if (!existsSync(this.filePath)) {
            return [];
        }
        const raw = readFileSync(this.filePath, "utf8");
        const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
        const records = [];
        let malformed = 0;
        let firstBadLine;
        for (const line of lines) {
            try {
                records.push(JSON.parse(line));
            }
            catch {
                malformed += 1;
                if (firstBadLine === undefined) {
                    firstBadLine = line.slice(0, 200);
                }
            }
        }
        if (malformed > 0) {
            console.error(`[jsonl-writer] ${this.filePath}: skipped ${malformed} malformed line(s); first=${JSON.stringify(firstBadLine)}`);
        }
        return records;
    }
    clear() {
        this.closeFd();
        if (existsSync(this.filePath)) {
            writeFileSync(this.filePath, "", "utf8");
        }
        this.nextSequence = 0;
        this.appendsSinceFsync = 0;
    }
    /** Flush and close the underlying descriptor. No-op if already closed. */
    close() {
        this.fsync();
        this.closeFd();
    }
    ensureDirectory() {
        mkdirSync(this.rootDir, { recursive: true });
    }
    ensureOpen() {
        this.ensureDirectory();
        if (this.fd !== null) {
            return;
        }
        this.fd = openSync(this.filePath, constants.O_CREAT | constants.O_RDWR | constants.O_APPEND, 0o644);
    }
    fsync() {
        if (this.fd === null) {
            return;
        }
        try {
            fsyncSync(this.fd);
        }
        catch {
            // best-effort fsync
        }
    }
    closeFd() {
        if (this.fd === null) {
            return;
        }
        try {
            closeSync(this.fd);
        }
        catch {
            // best-effort close
        }
        this.fd = null;
    }
    rotateIfNeeded() {
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
        }
        catch {
            // best-effort rotation
        }
    }
}
//# sourceMappingURL=jsonl-writer.js.map