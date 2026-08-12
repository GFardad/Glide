import { createHmac, randomBytes } from "node:crypto";

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

export class CapabilityTokenError extends Error {
  constructor(
    public readonly code: "MALFORMED_TOKEN" | "INVALID_SIGNATURE" | "TOKEN_EXPIRED" | "TOKEN_NOT_YET_VALID" | "SCOPE_MISSING" | "REPLAY_DETECTED",
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "CapabilityTokenError";
  }
}

export class CapabilityTokenService {
  private readonly secret: Buffer;
  private readonly defaultTtlSeconds: number;
  private readonly clockSkewSeconds: number;
  private readonly nonceRegistry = new Set<string>();
  private readonly revoked = new Set<string>();

  constructor(options: CapabilityTokenOptions) {
    if (!options.secret || options.secret.length < 32) {
      throw new CapabilityTokenError("INVALID_SIGNATURE", "Capability token secret must be at least 32 characters");
    }
    this.secret = Buffer.from(options.secret, "utf8");
    this.defaultTtlSeconds = options.defaultTtlSeconds ?? 600;
    this.clockSkewSeconds = options.clockSkewSeconds ?? 30;
  }

  sign(payload: Omit<CapabilityTokenPayload, "nbf" | "exp" | "jti"> & { exp?: number }): SignedCapabilityToken {
    const now = Math.floor(Date.now() / 1000);
    const completePayload: CapabilityTokenPayload = {
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

  verify(token: string, requiredScopes: string[] = []): CapabilityTokenPayload {
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

    let payload: CapabilityTokenPayload;
    try {
      payload = JSON.parse(Buffer.from(bodyB64 as string, "base64url").toString("utf8")) as CapabilityTokenPayload;
    } catch {
      throw new CapabilityTokenError("MALFORMED_TOKEN", "Token payload is not valid JSON");
    }

    const now = Math.floor(Date.now() / 1000);
    if (now < payload.nbf - this.clockSkewSeconds) {
      throw new CapabilityTokenError(
        "TOKEN_NOT_YET_VALID",
        `Token is not yet valid; nbf=${payload.nbf}, now=${now}`
      );
    }
    if (now > payload.exp + this.clockSkewSeconds) {
      throw new CapabilityTokenError(
        "TOKEN_EXPIRED",
        `Token expired at ${payload.exp}; now=${now}`
      );
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
        throw new CapabilityTokenError(
          "SCOPE_MISSING",
          `Token is missing required scopes: ${missing.join(", ")}`
        );
      }
    }

    return payload;
  }

  revoke(token: string): void {
    this.revoked.add(token);
  }

  revokeAll(subject: string): void {
    // Mark all tokens for a subject as revoked. In a production system this would query a backing store.
    this.revoked.forEach((token) => {
      try {
        const payload = this.verify(token);
        if (payload.sub === subject) {
          this.revoked.add(token);
        }
      } catch {
        // ignore malformed tokens during sweep
      }
    });
  }
}

export function createCapabilityTokenService(options: CapabilityTokenOptions): CapabilityTokenService {
  return new CapabilityTokenService(options);
}
