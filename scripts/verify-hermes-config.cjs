#!/usr/bin/env node
/**
 * Verify Hermes MCP config for Glide.
 *
 * Checks:
 *  1. ~/.hermes/config.yaml exists and is readable
 *  2. config.yaml has a top-level MCP servers mapping (`mcp_servers` or `mcpServers`)
 *  3. `glide` server entry exists and is an object
 *  4. `glide.command` exists and is a non-empty string
 *  5. `glide.command` points to an existing executable/file
 *  6. `glide.args` is an array when present
 *
 * Exit codes:
 *  0  pass
 *  1  config missing or invalid structure
 *  2  glide command path does not exist
 */

const fs = require("node:fs");
const path = require("node:path");

const CONFIG_PATH = path.resolve(
  process.env.HERMES_HOME
    ? path.join(process.env.HERMES_HOME, "config.yaml")
    : path.join(process.env.HOME || "~", ".hermes", "config.yaml")
);

const FAIL_CONFIG = 1;
const FAIL_BINARY = 2;

function fail(code, message) {
  console.error(`[verify-hermes-config] FAIL: ${message}`);
  process.exit(code);
}

function ok(message) {
  console.log(`[verify-hermes-config] OK: ${message}`);
}

function parseScalar(value) {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed === "[]") return [];
  if (trimmed === "{}") return {};
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (!Number.isNaN(Number(trimmed))) return Number(trimmed);
  return trimmed;
}

function loadYaml(raw) {
  const root = {};
  const lines = raw.split(/\r?\n/);
  const stack = [{ node: root, indent: -1, key: null }];

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, "");
    if (!line.trim()) continue;
    const indent = rawLine.search(/\S/);
    const trimmed = line.trim();
    if (!trimmed) continue;

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].node;

    if (trimmed.startsWith("- ")) {
      const value = trimmed.slice(2).trim();
      let arr = parent._lastArray;
      if (!Array.isArray(arr)) {
        const lastKey = Object.keys(parent).find((k) => Array.isArray(parent[k]));
        arr = lastKey ? parent[lastKey] : null;
      }
      if (!Array.isArray(arr)) {
        const newArr = [];
        const parentObj = stack[stack.length - 1].node;
        if (stack[stack.length - 1].key) {
          parentObj[stack[stack.length - 1].key] = newArr;
        } else {
          const keys = Object.keys(parentObj);
          const last = keys[keys.length - 1];
          parentObj[last] = newArr;
        }
        stack[stack.length - 1].node = parentObj;
        arr = newArr;
        stack.push({ node: newArr, indent, key: null });
        arr.push(parseScalar(value));
      } else {
        arr.push(parseScalar(value));
      }
    } else if (trimmed.includes(":")) {
      const idx = trimmed.indexOf(":");
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      const child = value ? parseScalar(value) : {};
      parent[key] = child;
      stack[stack.length - 1].node = parent;
      stack.push({ node: child, indent, key });
    }
  }

  const unwrap = (obj) => {
    if (Array.isArray(obj)) return obj.map(unwrap);
    if (obj && typeof obj === "object") {
      const out = {};
      for (const [k, v] of Object.entries(obj)) {
        if (k === "_lastArray") continue;
        out[k] = unwrap(v);
      }
      return out;
    }
    return obj;
  };

  return unwrap(root);
}

function main() {
  if (!fs.existsSync(CONFIG_PATH)) {
    fail(FAIL_CONFIG, `Hermes config not found at ${CONFIG_PATH}`);
  }

  const raw = fs.readFileSync(CONFIG_PATH, "utf8");
  const config = loadYaml(raw);

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    fail(FAIL_CONFIG, "config.yaml root is not an object");
  }

  const mcpKey = config.mcp_servers ? "mcp_servers" : config.mcpServers ? "mcpServers" : null;
  if (!mcpKey) {
    fail(FAIL_CONFIG, "config.yaml missing MCP servers mapping (`mcp_servers` or `mcpServers`)");
  }

  const servers = config[mcpKey];
  if (!servers || typeof servers !== "object" || Array.isArray(servers)) {
    fail(FAIL_CONFIG, `config.yaml \`${mcpKey}\` is not a mapping`);
  }

  const glide = servers.glide;
  if (!glide || typeof glide !== "object" || Array.isArray(glide)) {
    fail(FAIL_CONFIG, `config.yaml missing \`${mcpKey}.glide\` block`);
  }

  if (!("command" in glide) || typeof glide.command !== "string" || !glide.command.trim()) {
    fail(FAIL_CONFIG, `\`${mcpKey}.glide.command\` must be a non-empty string`);
  }

  ok("config.yaml structure looks good");

  const command = glide.command.trim();
  const resolvedCommand = path.isAbsolute(command)
    ? command
    : path.resolve(path.dirname(CONFIG_PATH), command);

  if (!fs.existsSync(resolvedCommand)) {
    console.error(`[verify-hermes-config] NOTE: glide command not found at ${resolvedCommand}`);
    fail(FAIL_BINARY, `glide command path does not exist: ${resolvedCommand}`);
  }

  const stat = fs.statSync(resolvedCommand);
  if (stat.isFile() && (stat.mode & 0o100) === 0 && !resolvedCommand.endsWith(".js") && !resolvedCommand.endsWith(".ts")) {
    console.error(`[verify-hermes-config] NOTE: glide command is not executable: ${resolvedCommand}`);
    fail(FAIL_BINARY, `glide command is not executable: ${resolvedCommand}`);
  }

  ok(`glide command exists: ${resolvedCommand}`);

  if ("args" in glide) {
    if (!Array.isArray(glide.args)) {
      fail(FAIL_CONFIG, `\`${mcpKey}.glide.args\` must be an array when present`);
    }
    ok("glide args is an array");
  } else {
    ok("glide args omitted");
  }

  console.log(`[verify-hermes-config] PASS: Hermes glide MCP config verified against ${CONFIG_PATH}`);
}

main();
