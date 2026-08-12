import { HostRoute, HostRequest } from "./types.js";

export const MCP_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

export type HostErrorCode =
  | typeof MCP_ERROR_CODES[keyof typeof MCP_ERROR_CODES];

export interface HostErrorEnvelope {
  code: HostErrorCode;
  message: string;
  data?: unknown;
}

export class HostBridge {
  private nextId = 1;
  private readonly routes = new Map<string, HostRoute<unknown, unknown>>();

  on(route: HostRoute<unknown, unknown>): void {
    this.routes.set(route.method, route);
  }

  async handle(input: string): Promise<string> {
    let envelope: unknown;
    try {
      envelope = JSON.parse(input);
    } catch {
      return this.buildErrorResponse(
        this.createRequestEnvelope(null, ""),
        {
          code: MCP_ERROR_CODES.PARSE_ERROR,
          message: "Invalid JSON envelope.",
        }
      );
    }

    if (!this.isHostRequestEnvelope(envelope)) {
      return this.buildErrorResponse(
        this.createRequestEnvelope(null, ""),
        {
          code: MCP_ERROR_CODES.INVALID_REQUEST,
          message: "Envelope must be a JSON-RPC 2.0 request.",
        }
      );
    }

    const request = envelope as HostRequest<unknown>;
    const isNotification = request.id === undefined;
    const route = this.routes.get(request.method);

    if (!route) {
      if (isNotification) {
        return "";
      }
      return this.buildErrorResponse(request, {
        code: MCP_ERROR_CODES.METHOD_NOT_FOUND,
        message: `No host handler registered for method: ${request.method}`,
      });
    }

    try {
      const result = await route.handler(request);
      if (isNotification) {
        return "";
      }
      return JSON.stringify({
        jsonrpc: "2.0" as const,
        id: request.id,
        result,
      } as const);
    } catch (error) {
      if (isNotification) {
        return "";
      }
      const message = error instanceof Error ? error.message : "Host handler failed.";
      return this.buildErrorResponse(request, {
        code: MCP_ERROR_CODES.INTERNAL_ERROR,
        message,
        data: error instanceof Error ? { name: error.name } : undefined,
      });
    }
  }

  private createRequestEnvelope(
    id: string | number | null,
    method: string
  ): HostRequest<unknown> {
    return {
      jsonrpc: "2.0",
      id: id ?? this.nextId++,
      method,
    };
  }

  private buildErrorResponse(
    request: HostRequest<unknown> | null,
    error: { code: number; message: string; data?: unknown }
  ): string {
    const id =
      request && "id" in request
        ? (request as { id: string | number }).id
        : this.nextId++;

    return JSON.stringify({
      jsonrpc: "2.0" as const,
      id,
      error,
    } as const);
  }

  private isHostRequestEnvelope(value: unknown): value is HostRequest<unknown> {
    if (typeof value !== "object" || value === null) {
      return false;
    }

    const record = value as Record<string, unknown>;
    return record.jsonrpc === "2.0" && typeof record.method === "string";
  }
}
