# @glide/mcp-server

The Glide control plane: an MCP stdio server exposing all 14 `glide_*` tools.

## Running

```bash
pnpm --filter @glide/mcp-server build
node packages/mcp-server/dist/index.js
```

Speak MCP JSON-RPC over stdio (initialize → tools/list → tools/call).

## Tools

`glide_status`, `glide_goal_set`, `glide_goal_get`, `glide_headroom`, `glide_executor`,
`glide_tracer`, `glide_permissions`, `glide_indepth`, `glide_trace`, `glide_plan`,
`glide_build`, `glide_test`, `glide_review`, `glide_ship`.

Full input/output shapes: [`docs/api.md`](../../docs/api.md).

## Wiring

Tools are plain `GlideTool` objects (`name`, `description`, `inputSchema`, `handler`)
in `src/tools/`; `server.ts` registers them. Add a new tool in three steps:

1. create `src/tools/glide-*.ts` exporting a `GlideTool`
2. export it from `src/tools/index.ts`
3. import + push it onto `tools` in `src/server.ts`
