import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { GlideTool } from "./types.js";
import { PermissionRuntime } from "@glide/permissions";

const runtime = new PermissionRuntime();

export const glidePermissionsTool: GlideTool = {
  name: "glide_permissions",
  description: "Check whether a subject is authorized to perform an action on a resource.",
  inputSchema: {
    type: "object",
    properties: {
      action: { type: "string" },
      resource: { type: "string" },
      subject_id: { type: "string" },
      subject_role: { type: "string" },
    },
    required: ["action", "resource", "subject_id", "subject_role"],
  },
  allowedRoles: ["Security", "Architect"],
  requiredScopes: ["permissions", "auth"],
  handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const action = args.action as string;
    const resource = args.resource as string;
    const subjectId = args.subject_id as string;
    const subjectRole = args.subject_role as string;

    if (!action || !resource || !subjectId || !subjectRole) {
      return {
        content: [{ type: "text", text: JSON.stringify({ ok: false, reason: "missing_fields" }) }],
      };
    }

    const secretsScopes = ["secrets", "secrets:read", "secrets:write"];
    const requiresSecrets = secretsScopes.some((scope) => (args.scopes as string[] | undefined)?.includes(scope));
    if (requiresSecrets && !(args.scopes as string[] | undefined)?.includes("secrets")) {
      return {
        content: [{ type: "text", text: JSON.stringify({ ok: false, reason: "secrets_scope_required" }) }],
      };
    }

    const subject = runtime.createSubject(subjectRole, (args.scopes as string[] | undefined) ?? [action]);
    const result = runtime.authorize(subject, { action, resource });
    return {
      content: [{ type: "text", text: JSON.stringify({ ok: result.ok, subject_id: subjectId, allowed: result.ok, ...(result.reason ? { reason: result.reason } : {}) }) }],
    };
  },
};
