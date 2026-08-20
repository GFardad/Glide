import { PermissionRuntime } from "@glide/permissions";
const runtime = new PermissionRuntime();
export const glidePermissionsTool = {
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
    handler: (args) => {
        const action = args.action;
        const resource = args.resource;
        const subjectId = args.subject_id;
        const subjectRole = args.subject_role;
        if (!action || !resource || !subjectId || !subjectRole) {
            return {
                content: [{ type: "text", text: JSON.stringify({ ok: false, reason: "missing_fields" }) }],
            };
        }
        const secretsScopes = ["secrets", "secrets:read", "secrets:write"];
        const requiresSecrets = secretsScopes.some((scope) => args.scopes?.includes(scope));
        if (requiresSecrets && !args.scopes?.includes("secrets")) {
            return {
                content: [{ type: "text", text: JSON.stringify({ ok: false, reason: "secrets_scope_required" }) }],
            };
        }
        const subject = runtime.createSubject(subjectRole, args.scopes ?? [action]);
        const result = runtime.authorize(subject, { action, resource });
        return {
            content: [{ type: "text", text: JSON.stringify({ ok: result.ok, subject_id: subjectId, allowed: result.ok, ...(result.reason ? { reason: result.reason } : {}) }) }],
        };
    },
};
//# sourceMappingURL=glide-permissions.js.map