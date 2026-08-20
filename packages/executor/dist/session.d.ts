import type { AgentHandle } from "./agent-handle.js";
export interface SessionEvent {
    type: string;
    handle: string;
    sessionId: string;
    timestamp: string;
    traceId?: string | undefined;
    spanId?: string | undefined;
    payload?: Record<string, unknown>;
}
export interface SessionEventWriterOptions {
    rootDir?: string | undefined;
    eventFile?: string | undefined;
    maxBytes?: number | undefined;
    maxFiles?: number | undefined;
}
export declare class SessionEventWriter {
    private readonly filePath;
    private nextSequence;
    private readonly writer;
    constructor(options?: SessionEventWriterOptions);
    write(event: SessionEvent): void;
    readAll(): SessionEvent[];
    readForHandle(handle: string): SessionEvent[];
    clear(): void;
}
export declare class SessionReplayHelper {
    private readonly writer;
    constructor(writer: SessionEventWriter);
    replay(handle?: string): Promise<SessionEvent[]>;
    replayAsStream(handle?: string): Promise<SessionEvent[]>;
}
export interface SessionStoreOptions {
    rootDir?: string;
    recordsFile?: string;
}
export declare class SessionStore {
    private readonly writer;
    constructor(options?: SessionStoreOptions);
    upsert(handle: AgentHandle): Promise<void>;
    readForHandle(handleId: string): Promise<SessionEvent[]>;
    readAll(): Promise<SessionEvent[]>;
}
export interface SessionEventEmitterOptions {
    rootDir?: string | undefined;
    eventFile?: string | undefined;
    enabled?: boolean | undefined;
}
export declare class SessionEventEmitter {
    private readonly writer;
    private readonly enabled;
    constructor(options?: SessionEventEmitterOptions);
    emit(type: string, handle: AgentHandle, extraPayload?: Record<string, unknown>): Promise<void>;
    create(handle: AgentHandle): Promise<void>;
    update(handle: AgentHandle, patch: Record<string, unknown>): Promise<void>;
    complete(handle: AgentHandle): Promise<void>;
    fail(handle: AgentHandle): Promise<void>;
    cancel(handle: AgentHandle): Promise<void>;
}
export declare class SessionRuntime {
    private readonly emitter;
    constructor(options?: SessionEventEmitterOptions);
    createEmitter(): SessionEventEmitter;
    dispose(): Promise<void>;
}
//# sourceMappingURL=session.d.ts.map