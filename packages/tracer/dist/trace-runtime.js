import { JsonlWriter } from "./jsonl-writer.js";
export class TraceRuntime {
    writer;
    constructor(options = {}) {
        this.writer = new JsonlWriter({
            rootDir: options.rootDir ?? ".glide-sessions",
            fileName: options.fileName ?? "trace-events.jsonl",
            maxBytes: options.maxBytes,
            maxFiles: options.maxFiles,
        });
    }
    async log(event, correlation) {
        const payload = {
            _ts: new Date().toISOString(),
            traceId: correlation?.traceId ?? event.traceId,
            spanId: correlation?.spanId ?? event.spanId,
            sessionId: correlation?.sessionId ?? event.sessionId,
            ...event,
        };
        await this.writer.append(payload);
    }
    async readAll() {
        return this.writer.readAll();
    }
    async clear() {
        await this.writer.clear();
    }
}
//# sourceMappingURL=trace-runtime.js.map