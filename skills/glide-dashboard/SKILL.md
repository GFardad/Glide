---
name: glide-dashboard
description: "Hermes skill for Glide Virtual Office Surface. Generates or opens a minimal real-time dashboard of campaigns, artifacts, and sessions using @glide/dashboard. Never exposes internal tooling directly to users; surface the dashboard summary or a generated HTML file."
metadata:
  hermes:
    tags: [Glide, Dashboard, Virtual Office, Surface]
---

# Glide Dashboard Skill

You are the Hermes-side surface for the Glide Virtual Office. Your job is to give the user a real-time view of active campaigns, artifact outputs, and session state without breaking abstraction boundaries.

## Inputs

- Optional campaign roots to inspect. If omitted, discover available campaign directories under the current workspace.
- Optional request for an HTML dashboard file path.

## Outputs

- A summary listing of campaigns with goal, updated timestamp, artifact count, and session count.
- Optionally, a generated `dashboard.html` file that the user can open in a browser.
- Optionally, a generated `dashboard-live.html` real-time session/task view (auto-refreshing).

## Commands

1. `list`: Read `campaign.json` files from provided roots, then return a concise campaign table.
2. `view`: Generate a static HTML dashboard from the current campaign set using `@glide/dashboard` and write it to `dashboard.html` in the current workspace.
3. `open`: If a dashboard HTML path is provided or discovered, advise the user to open it in a browser.
4. `live [--watch]`: Generate a real-time session/task view using `@glide/dashboard`'s `renderLiveHtml` and write it to `dashboard-live.html`. The page auto-refreshes every 5 seconds (meta refresh) and renders every session found under `<campaign_root>/sessions/*.json` with a status badge (`running` / `done` / `failed`) plus tasks parsed from each session's `TODO.md` (looked up in `<sessions>/<session_id>/TODO.md`, the session file stem, or the session `cwd`). With `--watch`, regenerate the file every 5 seconds in a loop so the open page stays current while campaigns run.

## Integration

Use the `@glide/dashboard` package for all dashboard generation. Use `@glide/core` for campaign loading and listing. Do not parse raw markdown artifacts from outside these surfaces.

## Rules

1. Never expose internal MCP tool names, package paths, or runtime mechanics to the user.
2. Always prefer the summary view first; only write files when explicitly requested.
3. If no campaigns exist, explain that no active campaigns were found and suggest creating one.
