# @glide/plugin-api

Plugin surface for Glide: registry, loaders, and Prime-Agent session durability.

## Public API

- `PluginDescriptor` / `PluginInstance` / `PluginEntrypointDescriptor` — manifest contract (`kind`: `"mcp" | "agent-hook" | "skill"`)
- `PluginLoadError` — typed errors: `NOT_FOUND`, `INVALID_MANIFEST`, `LOAD_FAILED`, `DUPLICATE_ID`
- `MCPPluginRegistry` — register / list / load / unregister / has
- `PluginLoaderRegistry` — kind-scoped loader registration
- `loadWithLoader(loader, descriptor)` — catch-and-wrap loading
- `PrimeAgentSessionDurability` — snapshot/restore plugin state across sessions (see `durability.ts`)
- `IPluginLoader` — implement `load(descriptor)` + optional `resolve(descriptor)`

## Usage

```ts
import { MCPPluginRegistry, PluginLoadError } from "@glide/plugin-api";

const reg = new MCPPluginRegistry();
reg.register(descriptor);
reg.list(); // PluginInstance[]
```

Reference implementation: `plugins/example-plugin`.
