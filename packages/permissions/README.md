# @glide/permissions

Authorization layer for Glide operations.

## Public API

- `createSubject(role, actions)` — subject with role + permitted action list
- `authorize(subject, { action, resource })` — `{ ok, allowed, reason? }`
- `loadPolicies(dir)` / `savePolicies(dir, policies)` — JSON policy persistence
- `requestPermission / approveRequest / rejectRequest` — request lifecycle (PENDING → APPROVED/REJECTED)
- roles: `admin`, `engineer`, `agent`, `qa`, `security`, `product`

## Usage

```ts
import { createSubject, authorize } from "@glide/permissions";

const subject = createSubject("agent", ["executor.run"]);
const r = authorize(subject, {
  action: "executor.run",
  resource: "campaign:abc",
});
```
