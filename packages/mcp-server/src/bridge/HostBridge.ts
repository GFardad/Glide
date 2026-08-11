import { HostRoute, HostHandler, HostRequest } from "./types.js";

export class HostBridge {
  private nextId = 1;
  private readonly routes = new Map<string, HostRoute<any, any>>();

  on(route: HostRoute<any, any>): void {
    this.routes.set(route.method, route);
  }

  async handle(input: string): Promise<string> {
    let envelope: unknown;
    try {
      envelope = JSON.parse(input);
    } catch {
      return this.buildErrorResponse(this.createRequestEnvelope(null, ""), {
        code: "PARSE_ERROR",
        message: "Invalid JSON envelope.",
      });
    }

    if (!this.isHostRequestEnvelope(envelope)) {
      return this.buildErrorResponse(
        this.createRequestEnvelope(null, ""),
        {
          code: "INVALID_REQUEST",
          message: "Envelope must be a JSON-RPC 2.0 request.",
        }
      );
    }

    const request = envelope as HostRequest<unknown>;
    const route = this.routes.get(request.method);

    if (!route) {
      return this.buildErrorResponse(request, {
        code: "METHOD_NOT_FOUND",
        message: `No host handler registered for method: ${request.method}`,
      });
    }

    try {
      const result = await route.handler(request);
      if (request.id === undefined) {
        return "";
      }
      return JSON.stringify({
        jsonrpc: "2.0",
        id: request.id,
        result,
      } as const);
    } catch (error) {
      if (request.id === undefined) {
        return "";
      }
      const message = error instanceof Error ? error.message : "Host handler failed.";
      return this.buildErrorResponse(request, {
        code: "INTERNAL_ERROR",
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
    error: { code: string; message: string; data?: unknown }
  ): string {
    const id =
      request && "id" in request
        ? (request as { id: string | number }).id
        : this.nextId++;

    return JSON.stringify({
      jsonrpc: "2.0",
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
