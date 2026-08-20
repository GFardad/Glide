import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { JsonlWriter } from "@glide/tracer";
export class SessionEventWriter {
    filePath;
    nextSequence = 0;
    writer;
    constructor(options = {}) {
        const rootDir = options.rootDir ?? ".glide-sessions";
        const eventFile = options.eventFile ?? "session-events.jsonl";
        this.filePath = join(rootDir, eventFile);
        this.writer = new JsonlWriter({
            rootDir,
            fileName: eventFile,
            maxBytes: options.maxBytes,
            maxFiles: options.maxFiles,
        });
    }
    write(event) {
        const payload = {
            _seq: this.nextSequence++,
            _ts: event.timestamp,
            type: event.type,
            handle: event.handle,
            sessionId: event.sessionId,
            traceId: event.traceId,
            spanId: event.spanId,
            ...event.payload,
        };
        this.writer.append(payload);
    }
    readAll() {
        if (!existsSync(this.filePath)) {
            return [];
        }
        const raw = readFileSync(this.filePath, "utf8");
        const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
        const events = [];
        let malformed = 0;
        let firstBadLine;
        for (const line of lines) {
            try {
                const record = JSON.parse(line);
                events.push({
                    type: String(record.type),
                    handle: String(record.handle),
                    sessionId: String(record.sessionId ?? record._ts ?? record.timestamp ?? new Date().toISOString()),
                    timestamp: String(record._ts ?? record.timestamp ?? new Date().toISOString()),
                    traceId: record.traceId,
                    spanId: record.spanId,
                    payload: record.payload ?? {},
                });
            }
            catch {
                malformed += 1;
                if (firstBadLine === undefined) {
                    firstBadLine = line.slice(0, 200);
                }
            }
        }
        if (malformed > 0) {
            console.error(`[session-writer] ${this.filePath}: skipped ${malformed} malformed line(s); first=${JSON.stringify(firstBadLine)}`);
        }
        return events;
    }
    readForHandle(handle) {
        return this.readAll().filter((event) => event.handle === handle);
    }
    clear() {
        if (!existsSync(this.filePath)) {
            return;
        }
        writeFileSync(this.filePath, "", "utf8");
        this.nextSequence = 0;
    }
}
// ---------------------------------------------------------------------------
// Replay helper
// ---------------------------------------------------------------------------
export class SessionReplayHelper {
    writer;
    constructor(writer) {
        this.writer = writer;
    }
    async replay(handle) {
        if (handle) {
            return this.writer.readForHandle(handle);
        }
        return this.writer.readAll();
    }
    async replayAsStream(handle) {
        return this.replay(handle);
    }
}
export class SessionStore {
    writer;
    constructor(options = {}) {
        this.writer = new SessionEventWriter({
            rootDir: options.rootDir,
            eventFile: options.recordsFile ?? "session-handles.jsonl",
        });
    }
    async upsert(handle) {
        await this.writer.write({
            type: "session_event",
            handle: handle.id,
            sessionId: handle.sessionId ?? handle.id,
            timestamp: new Date().toISOString(),
            traceId: handle.traceId,
            spanId: handle.spanId,
            payload: {
                status: handle.status,
                parentId: handle.parentId,
                returnCode: handle.returnCode,
            },
        });
    }
    async readForHandle(handleId) {
        return this.writer.readForHandle(handleId);
    }
    async readAll() {
        return this.writer.readAll();
    }
}
export class SessionEventEmitter {
    writer;
    enabled;
    constructor(options = {}) {
        this.enabled = options.enabled ?? false;
        this.writer = options.enabled
            ? new SessionEventWriter({
                rootDir: options.rootDir,
                eventFile: options.eventFile,
            })
            : null;
    }
    async emit(type, handle, extraPayload) {
        if (!this.writer)
            return;
        const event = {
            type,
            handle: handle.id,
            sessionId: handle.sessionId ?? handle.id,
            timestamp: new Date().toISOString(),
            traceId: handle.traceId,
            spanId: handle.spanId,
            payload: {
                status: handle.status,
                parentId: handle.parentId,
                returnCode: handle.returnCode ?? null,
                ...extraPayload,
            },
        };
        await this.writer.write(event);
    }
    async create(handle) {
        await this.emit("session_created", handle);
    }
    async update(handle, patch) {
        await this.emit("session_event", handle, patch);
    }
    async complete(handle) {
        await this.emit("session_completed", handle, {
            returnCode: handle.returnCode,
        });
    }
    async fail(handle) {
        await this.emit("session_failed", handle, {
            returnCode: handle.returnCode,
        });
    }
    async cancel(handle) {
        await this.emit("session_cancelled", handle);
    }
}
export class SessionRuntime {
    emitter;
    constructor(options = {}) {
        this.emitter = new SessionEventEmitter(options);
    }
    createEmitter() {
        return this.emitter;
    }
    async dispose() {
        // no-op placeholder for future teardown of writer resources
    }
}
//# sourceMappingURL=session.js.map