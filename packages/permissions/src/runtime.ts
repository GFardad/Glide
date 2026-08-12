import { randomUUID } from "node:crypto";
import { z } from "zod";

export interface PermissionSubject {
  id: string;
  role: string;
  scopes: string[];
}

export interface PermissionAction {
  action: string;
  resource: string;
}

export interface PermissionRuntimeOptions {
  allowedActions?: string[];
  actionScopes?: Map<string, string>;
}

export class PermissionRuntime {
  private readonly allowedActions: Set<string>;
  private readonly actionScopes: Map<string, string>;

  constructor(options: PermissionRuntimeOptions = {}) {
    this.allowedActions = new Set(options.allowedActions ?? ["read", "write", "plan", "execute", "review"]);
    this.actionScopes = options.actionScopes ?? new Map([
      ["read", "read"],
      ["write", "write"],
      ["plan", "plan"],
      ["execute", "execute"],
      ["review", "review"],
    ]);
  }

  createSubject(role: string, scopes: string[]): PermissionSubject {
    return createSubject(role, scopes);
  }

  authorize(subject: PermissionSubject, action: PermissionAction): { ok: boolean; reason?: string } {
    const parsed = actionSchema.safeParse(action);
    if (!parsed.success) {
      return { ok: false, reason: "invalid_action_shape" };
    }

    if (!this.allowedActions.has(parsed.data.action)) {
      return { ok: false, reason: "unsupported_action" };
    }

    if (
      parsed.data.resource === "secrets" &&
      !subject.scopes.includes("secrets")
    ) {
      return { ok: false, reason: "secrets_scope_required" };
    }

    const scope = this.actionScopes.get(parsed.data.action);
    if (scope && !subject.scopes.includes(scope)) {
      return { ok: false, reason: `${parsed.data.action}_scope_required` };
    }

    return { ok: true };
  }
}

export function createSubject(role: string, scopes: string[]): PermissionSubject {
  return { id: randomUUID(), role, scopes };
}

export function authorize(
  subject: PermissionSubject,
  action: PermissionAction
): { ok: boolean; reason?: string } {
  const runtime = new PermissionRuntime();
  return runtime.authorize(subject, action);
}

const actionSchema = z.object({
  action: z.string(),
  resource: z.string(),
});
