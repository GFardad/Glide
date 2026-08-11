# @glide/dashboard

Virtual Office surface: campaign, session, and task visualization.

## Public API

- `renderHtml(campaignDir, opts?)` — static dashboard from `campaign.json` / `artifacts/` / `sessions/`
- `renderLiveHtml(campaignDir, opts?)` — real-time view: session status badges (`running` / `done` / `failed`), task listing from TODO files, auto-refresh (meta refresh + JS polling)
- `loadCampaign(dir)` / `listCampaigns(root)` — campaign discovery
- `SessionState` types — `{ session_id, objective, status, cwd, created_at }`

## Usage

```ts
import { renderHtml, renderLiveHtml } from "@glide/dashboard";

const html = renderLiveHtml("/tmp/c"); // auto-refreshing live view
```

Companion Hermes skill: `skills/glide-dashboard` (list / view / open / live).
