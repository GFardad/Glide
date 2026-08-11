import { randomUUID } from "node:crypto";
import { z } from "zod";

const ALLOWED_ACTIONS = new Set(["read", "write", "plan", "execute", "review"]);
const ACTION_SCOPES = new Map<string, string>([
  ["read", "read"],
  ["write", "write"],
  ["plan", "plan"],
  ["execute", "execute"],
  ["review", "review"],
]);

export interface PermissionSubject {
  id: string;
  role: string;
  scopes: string[];
}

export interface PermissionAction {
  action: string;
  resource: string;
}

const actionSchema = z.object({
  action: z.string(),
  resource: z.string(),
});

export function createSubject(
  role: string,
  scopes: string[]
): PermissionSubject {
  return {
    id: randomUUID(),
    role,
    scopes,
  };
}

export function authorize(
  subject: PermissionSubject,
  action: PermissionAction
): { ok: boolean; reason?: string } {
  const parsed = actionSchema.safeParse(action);
  if (!parsed.success) {
    return { ok: false, reason: "invalid_action_shape" };
  }

  if (!ALLOWED_ACTIONS.has(parsed.data.action)) {
    return { ok: false, reason: "unsupported_action" };
  }

  if (
    ACTION_SCOPES.get(parsed.data.action) &&
    !subject.scopes.includes(ACTION_SCOPES.get(parsed.data.action)!)
  ) {
    return { ok: false, reason: `${parsed.data.action}_scope_required` };
  }

  if (
    parsed.data.resource === "secrets" &&
    !subject.scopes.includes("secrets")
  ) {
    return { ok: false, reason: "secrets_scope_required" };
  }

  if (subject.scopes.length === 0) {
    return { ok: false, reason: "missing_scopes" };
  }

  return { ok: true };
}
