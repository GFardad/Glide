export interface CapabilityTokenPayload {
    /** Issuer who created the token (e.g. mcp-server, agent-worker). */
    iss: string;
    /** Subject the token authorizes (agent id, plugin id, tool name). */
    sub: string;
    /** Permissions granted by this token. */
    scopes: string[];
    /** Unix timestamp (seconds) when the token becomes valid. */
    nbf: number;
    /** Unix timestamp (seconds) when the token expires. */
    exp: number;
    /** Unique token identifier for revocation tracking. */
    jti: string;
    /** Optional nonce for replay protection. */
    nonce?: string;
}
export interface SignedCapabilityToken {
    token: string;
    payload: CapabilityTokenPayload;
}
export interface CapabilityTokenOptions {
    /** HMAC-SHA256 secret used to sign tokens. Must remain server-side only. */
    secret: string;
    /** Default token lifetime in seconds. Default: 600. */
    defaultTtlSeconds?: number;
    /** Clock skew tolerance in seconds for expiry checks. Default: 30. */
    clockSkewSeconds?: number;
}
export declare class CapabilityTokenError extends Error {
    readonly code: "MALFORMED_TOKEN" | "INVALID_SIGNATURE" | "TOKEN_EXPIRED" | "TOKEN_NOT_YET_VALID" | "SCOPE_MISSING" | "REPLAY_DETECTED";
    readonly cause?: unknown | undefined;
    constructor(code: "MALFORMED_TOKEN" | "INVALID_SIGNATURE" | "TOKEN_EXPIRED" | "TOKEN_NOT_YET_VALID" | "SCOPE_MISSING" | "REPLAY_DETECTED", message: string, cause?: unknown | undefined);
}
export declare class CapabilityTokenService {
    private readonly secret;
    private readonly defaultTtlSeconds;
    private readonly clockSkewSeconds;
    private readonly nonceRegistry;
    private readonly revoked;
    constructor(options: CapabilityTokenOptions);
    sign(payload: Omit<CapabilityTokenPayload, "nbf" | "exp" | "jti"> & {
        exp?: number;
    }): SignedCapabilityToken;
    verify(token: string, requiredScopes?: string[]): CapabilityTokenPayload;
    revoke(token: string): void;
    revokeAll(subject: string): void;
}
export declare function createCapabilityTokenService(options: CapabilityTokenOptions): CapabilityTokenService;
//# sourceMappingURL=capability-tokens.d.ts.map