# Glide MCP plugin

Glide exposes a stdio MCP server that Hermes can call from any session.

## Hermes config

Add the following block to `~/.hermes/config.yaml` under `mcpServers:`:

```yaml
mcpServers:
  glide:
    command: node
    args:
      - /home/gfardad/Projects/Glide/packages/mcp-server/dist/index.js
    env: {}
    enabled: true
    connect_timeout: 120
```

If Hermes lives under a custom `HERMES_HOME`, use the equivalent absolute path under that home.

### Notes

- The `command` can also be the absolute path to the JS file directly on Node 20+; using `node` + `args` keeps it portable.
- Keep `env: {}` unless the server later needs secrets.
- `connect_timeout` is optional; it only affects Hermes-side MCP client timeouts.

## Verify

Run:

```bash
node scripts/verify-hermes-config.cjs
```

It checks that the `mcpServers.glide` block exists and the command/args point to a real file.

## Troubleshooting

- **Config not found:** Set `HERMES_HOME` or update `scripts/verify-hermes-config.cjs` with the real path.
- **Command not found:** Build the server first: `pnpm build` from the Glide repo root, or `pnpm --filter @glide/mcp-server build`.
- **Unknown tool errors:** Restart the Hermes session/config after editing `config.yaml`; some environments require `/reset` or a full restart.
- **Script not executable:** On some setups, ensure `node` is on `PATH` and `packages/mcp-server/dist/index.js` exists after build.
