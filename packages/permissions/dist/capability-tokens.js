import { createHmac, randomBytes } from "node:crypto";
export class CapabilityTokenError extends Error {
    code;
    cause;
    constructor(code, message, cause) {
        super(message);
        this.code = code;
        this.cause = cause;
        this.name = "CapabilityTokenError";
    }
}
export class CapabilityTokenService {
    secret;
    defaultTtlSeconds;
    clockSkewSeconds;
    nonceRegistry = new Set();
    revoked = new Set();
    constructor(options) {
        if (!options.secret || options.secret.length < 32) {
            throw new CapabilityTokenError("INVALID_SIGNATURE", "Capability token secret must be at least 32 characters");
        }
        this.secret = Buffer.from(options.secret, "utf8");
        this.defaultTtlSeconds = options.defaultTtlSeconds ?? 600;
        this.clockSkewSeconds = options.clockSkewSeconds ?? 30;
    }
    sign(payload) {
        const now = Math.floor(Date.now() / 1000);
        const completePayload = {
            ...payload,
            nbf: now,
            exp: payload.exp ?? now + this.defaultTtlSeconds,
            jti: randomBytes(16).toString("hex"),
        };
        const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
        const body = Buffer.from(JSON.stringify(completePayload)).toString("base64url");
        const data = `${header}.${body}`;
        const signature = createHmac("sha256", this.secret).update(data).digest("base64url");
        return {
            token: `${data}.${signature}`,
            payload: completePayload,
        };
    }
    verify(token, requiredScopes = []) {
        if (typeof token !== "string" || token.split(".").length !== 3) {
            throw new CapabilityTokenError("MALFORMED_TOKEN", "Token must be a valid JWT-formatted string");
        }
        if (this.revoked.has(token)) {
            throw new CapabilityTokenError("REPLAY_DETECTED", "Token has been revoked");
        }
        const [headerB64, bodyB64, signatureB64] = token.split(".");
        const data = `${headerB64}.${bodyB64}`;
        const expectedSignature = createHmac("sha256", this.secret).update(data).digest("base64url");
        if (signatureB64 !== expectedSignature) {
            throw new CapabilityTokenError("INVALID_SIGNATURE", "Token signature verification failed");
        }
        let payload;
        try {
            payload = JSON.parse(Buffer.from(bodyB64, "base64url").toString("utf8"));
        }
        catch {
            throw new CapabilityTokenError("MALFORMED_TOKEN", "Token payload is not valid JSON");
        }
        const now = Math.floor(Date.now() / 1000);
        if (now < payload.nbf - this.clockSkewSeconds) {
            throw new CapabilityTokenError("TOKEN_NOT_YET_VALID", `Token is not yet valid; nbf=${payload.nbf}, now=${now}`);
        }
        if (now > payload.exp + this.clockSkewSeconds) {
            throw new CapabilityTokenError("TOKEN_EXPIRED", `Token expired at ${payload.exp}; now=${now}`);
        }
        if (payload.nonce && this.nonceRegistry.has(payload.nonce)) {
            throw new CapabilityTokenError("REPLAY_DETECTED", "Token nonce has already been used");
        }
        if (payload.nonce) {
            this.nonceRegistry.add(payload.nonce);
        }
        if (requiredScopes.length > 0) {
            const missing = requiredScopes.filter((scope) => !payload.scopes.includes(scope));
            if (missing.length > 0) {
                throw new CapabilityTokenError("SCOPE_MISSING", `Token is missing required scopes: ${missing.join(", ")}`);
            }
        }
        return payload;
    }
    revoke(token) {
        this.revoked.add(token);
    }
    revokeAll(subject) {
        // Mark all tokens for a subject as revoked. In a production system this would query a backing store.
        this.revoked.forEach((token) => {
            try {
                const payload = this.verify(token);
                if (payload.sub === subject) {
                    this.revoked.add(token);
                }
            }
            catch {
                // ignore malformed tokens during sweep
            }
        });
    }
}
export function createCapabilityTokenService(options) {
    return new CapabilityTokenService(options);
}
//# sourceMappingURL=capability-tokens.js.map