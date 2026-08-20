export type HostErrorCode = "PARSE_ERROR" | "INVALID_REQUEST" | "METHOD_NOT_FOUND" | "INVALID_PARAMS" | "INTERNAL_ERROR";
export interface HostErrorEnvelope {
    code: HostErrorCode;
    message: string;
    data?: unknown;
}
export interface HostRequest<TParams = unknown> {
    jsonrpc: "2.0";
    id: string | number;
    method: string;
    params?: TParams;
}
export interface HostSuccessEnvelope<TResult = unknown> {
    jsonrpc: "2.0";
    id: string | number;
    result: TResult;
}
export type HostResponse<TResult = unknown> = HostSuccessEnvelope<TResult> | {
    jsonrpc: "2.0";
    id: string | number;
    error: HostErrorEnvelope;
};
export interface HostNotification {
    jsonrpc: "2.0";
    method: string;
    params?: unknown;
}
export type HostHandler<TParams = unknown, TResult = unknown> = (request: HostRequest<TParams>) => Promise<TResult> | TResult;
export interface HostRoute<TParams = unknown, TResult = unknown> {
    method: string;
    handler: HostHandler<TParams, TResult>;
}
//# sourceMappingURL=types.d.ts.map