import { HostRoute } from "./types.js";
export declare const MCP_ERROR_CODES: {
    readonly PARSE_ERROR: -32700;
    readonly INVALID_REQUEST: -32600;
    readonly METHOD_NOT_FOUND: -32601;
    readonly INVALID_PARAMS: -32602;
    readonly INTERNAL_ERROR: -32603;
};
export type HostErrorCode = typeof MCP_ERROR_CODES[keyof typeof MCP_ERROR_CODES];
export interface HostErrorEnvelope {
    code: HostErrorCode;
    message: string;
    data?: unknown;
}
export declare class HostBridge {
    private nextId;
    private readonly routes;
    on(route: HostRoute<unknown, unknown>): void;
    handle(input: string): Promise<string>;
    private createRequestEnvelope;
    private buildErrorResponse;
    private isHostRequestEnvelope;
}
//# sourceMappingURL=HostBridge.d.ts.map