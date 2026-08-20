export const MCP_ERROR_CODES = {
    PARSE_ERROR: -32700,
    INVALID_REQUEST: -32600,
    METHOD_NOT_FOUND: -32601,
    INVALID_PARAMS: -32602,
    INTERNAL_ERROR: -32603,
};
export class HostBridge {
    nextId = 1;
    routes = new Map();
    on(route) {
        this.routes.set(route.method, route);
    }
    async handle(input) {
        let envelope;
        try {
            envelope = JSON.parse(input);
        }
        catch {
            return this.buildErrorResponse(this.createRequestEnvelope(null, ""), {
                code: MCP_ERROR_CODES.PARSE_ERROR,
                message: "Invalid JSON envelope.",
            });
        }
        if (!this.isHostRequestEnvelope(envelope)) {
            return this.buildErrorResponse(this.createRequestEnvelope(null, ""), {
                code: MCP_ERROR_CODES.INVALID_REQUEST,
                message: "Envelope must be a JSON-RPC 2.0 request.",
            });
        }
        const request = envelope;
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
                jsonrpc: "2.0",
                id: request.id,
                result,
            });
        }
        catch (error) {
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
    createRequestEnvelope(id, method) {
        return {
            jsonrpc: "2.0",
            id: id ?? this.nextId++,
            method,
        };
    }
    buildErrorResponse(request, error) {
        const id = request && "id" in request
            ? request.id
            : this.nextId++;
        return JSON.stringify({
            jsonrpc: "2.0",
            id,
            error,
        });
    }
    isHostRequestEnvelope(value) {
        if (typeof value !== "object" || value === null) {
            return false;
        }
        const record = value;
        return record.jsonrpc === "2.0" && typeof record.method === "string";
    }
}
//# sourceMappingURL=HostBridge.js.map