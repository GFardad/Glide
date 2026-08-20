import { spawnSync } from "node:child_process";
import { resolve, sep } from "node:path";

export interface CommandGuardOptions {
  allowedWorkspaceRoots?: string[];
  allowedCommands?: string[];
  allowedArguments?: string[];
}

export class CommandGuardError extends Error {
  constructor(
    public readonly code: "COMMAND_NOT_ALLOWED" | "CWD_OUTSIDE_WORKSPACE" | "INVALID_COMMAND" | "ARGUMENT_NOT_ALLOWED",
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "CommandGuardError";
  }
}

const DEFAULT_ALLOWED_COMMANDS = new Set([
  "git",
  "node",
  "npm",
  "npx",
  "pnpm",
  "yarn",
  "tsc",
  "vitest",
  "eslint",
  "prettier",
  "ls",
  "cat",
  "echo",
  "mkdir",
  "rm",
  "cp",
  "mv",
  "touch",
  "pwd",
  "true",
  "false",
  "grep",
  "sed",
  "awk",
  "find",
  "wc",
  "head",
  "tail",
  "sort",
  "uniq",
  "diff",
  "curl",
  "wget",
  "tar",
  "gzip",
  "gunzip",
  "zip",
  "unzip",
  "jq",
  "rg",
  "fd",
  "bat",
  "delta",
]);

const DEFAULT_ALLOWED_ARGUMENTS = new Set([
  "--help",
  "--version",
  "--json",
  "--list",
  "--all",
  "--recursive",
  "--no-color",
  "--silent",
  "--fail",
  "--noEmit",
  "--pretty",
  "false",
  "--no-cache",
]);

export function sanitizeWorkspacePath(candidate: string, allowedRoots: string[]): string {
  if (!allowedRoots.length) {
    throw new CommandGuardError(
      "CWD_OUTSIDE_WORKSPACE",
      "No allowed workspace roots configured; cannot sanitize cwd"
    );
  }

  const normalized = resolve(candidate);
  const normalizedRoots = allowedRoots.map((root) => {
    const resolved = resolve(root);
    return resolved.endsWith(sep) ? resolved : resolved + sep;
  });

  const withinAny = normalizedRoots.some((root) =>
    normalized.endsWith(sep) ? normalized.startsWith(root) : normalized === root.slice(0, -1) || normalized.startsWith(root)
  );

  if (!withinAny) {
    throw new CommandGuardError(
      "CWD_OUTSIDE_WORKSPACE",
      `Sanitized cwd "${normalized}" is outside allowed workspace roots`
    );
  }

  return normalized;
}

export function parseCommandString(command: string): { command: string; args: string[] } {
  const trimmed = command.trim();
  if (!trimmed) {
    throw new CommandGuardError("INVALID_COMMAND", "Command string is empty");
  }

  const args: string[] = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];

    if (inQuote) {
      if (char === quoteChar) {
        inQuote = false;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inQuote = true;
      quoteChar = char;
      continue;
    }

    if (char === " " || char === "\t") {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) {
    args.push(current);
  }

  if (!args.length) {
    throw new CommandGuardError("INVALID_COMMAND", "Unable to determine command name");
  }

  return { command: args[0] as string, args: args.slice(1) };
}

export function validateArgument(arg: string, allowedArguments: Set<string>): void {
  if (!allowedArguments.size) {
    return;
  }

  if (!allowedArguments.has(arg)) {
    throw new CommandGuardError(
      "ARGUMENT_NOT_ALLOWED",
      `Argument "${arg}" is not in the allowlist`
    );
  }
}

export function runAllowedCommand(command: string, cwd: string, options: CommandGuardOptions = {}): string {
  const allowedCommands = options.allowedCommands?.length
    ? new Set(options.allowedCommands)
    : DEFAULT_ALLOWED_COMMANDS;
  const allowedArguments = options.allowedArguments?.length
    ? new Set(options.allowedArguments)
    : DEFAULT_ALLOWED_ARGUMENTS;

  const parsed = parseCommandString(command);
  const commandName = parsed.command.split(sep).pop() ?? parsed.command;

  if (!commandName || commandName.length === 0) {
    throw new CommandGuardError("INVALID_COMMAND", "Unable to determine command name");
  }

  if (!allowedCommands.has(commandName)) {
    throw new CommandGuardError(
      "COMMAND_NOT_ALLOWED",
      `Command "${commandName}" is not in the allowlist`
    );
  }

  for (const arg of parsed.args) {
    validateArgument(arg, allowedArguments);
  }

  const sanitizedCwd = sanitizeWorkspacePath(cwd, options.allowedWorkspaceRoots ?? [process.cwd()]);

  const result = spawnSync(parsed.command, parsed.args, {
    cwd: sanitizedCwd,
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
    encoding: "utf8",
  });

  if (result.error) {
    throw new CommandGuardError("COMMAND_NOT_ALLOWED", `Command failed: ${result.error.message}`, result.error);
  }

  if (result.status !== 0) {
    const message = (result.stderr as string | undefined)?.trim() || `Command exited with code ${result.status}`;
    throw new CommandGuardError("COMMAND_NOT_ALLOWED", `Command failed: ${message}`);
  }

  return (result.stdout as string) ?? "";
}
