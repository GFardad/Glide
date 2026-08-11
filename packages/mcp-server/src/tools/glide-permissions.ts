import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { GlideTool } from "./types.js";
import { createSubject, authorize } from "@glide/permissions";

export const glidePermissionsTool: GlideTool = {
  name: "glide_permissions",
  description:
    "Check whether a subject is authorized to perform an action on a resource.",
  inputSchema: {
    type: "object",
    properties: {
      action: { type: "string", description: "Permission action to check" },
      resource: { type: "string", description: "Resource being accessed" },
      subject_id: { type: "string", description: "Subject identifier" },
      subject_role: {
        type: "string",
        description: "Subject role used for authorization",
      },
    },
    required: ["action", "resource", "subject_id", "subject_role"],
  },
  handler: (input: Record<string, unknown>): CallToolResult => {
    const subjectId =
      typeof input.subject_id === "string" ? input.subject_id : "";
    const subjectRole =
      typeof input.subject_role === "string" ? input.subject_role : "";
    const action = typeof input.action === "string" ? input.action : "";
    const resource = typeof input.resource === "string" ? input.resource : "";

    if (!subjectId || !subjectRole || !action || !resource) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ ok: false, reason: "missing_fields" }),
          },
        ],
      };
    }

    const subject = createSubject(subjectRole, [action]);
    const result = authorize(subject, { action, resource });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ subject_id: subjectId, ...result }),
        },
      ],
    };
  },
};
