# @glide/core

Campaign store: the durable contract for a Glide campaign.

## Public API

- `createCampaign(dir, goal, nonGoals, assumptions)` — create `campaign.json` + `GOAL.md` + `NON_GOALS.md` + `ASSUMPTIONS.md`
- `loadCampaign(dir)` — read a campaign
- `ensureCampaignDir(dir)` — create the campaign directory tree
- `Campaign` interface — `{ id, root, goal, nonGoals, assumptions, createdAt, updatedAt }`
- error classes — typed errors for missing/invalid campaigns

## Usage

```ts
import { createCampaign, loadCampaign } from "@glide/core";

createCampaign("/tmp/c", "build a login system", ["multi-tenant"], ["Node 20"]);
const c = loadCampaign("/tmp/c");
```

Campaign artifacts live in `<dir>/artifacts/`; agent execution state in `<dir>/agents/`.
