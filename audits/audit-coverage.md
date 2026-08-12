# Test Coverage Gap Analysis

**Generated from**: `coverage/coverage-final.json` and source tree

**Repo**: /media/Storage/home-gfardad/Projects/Glide

---

## Executive Summary

- **Tracked source files**: 62
- **0% / untracked**: 7
- **Weak coverage (<80% overall)**: 25
- **Strong coverage (≥80% overall)**: 30
- **Test files mapped**: 46 (global) + 3 (package-local)
- **Packages**: 8

---

## Weak Coverage (<80% Overall)

| Package | File | Stmts | Funcs | Branches | Overall | Has Dedicated Test |
|---|---|---|---|---|---|---|
| `core` | `packages/core/src/io/atomic-write.ts` | 6.67% | 0.0% | 0.0% | 2.22% | ✅ yes |
| `core` | `packages/core/src/security/path-guard.ts` | 7.41% | 0.0% | 0.0% | 2.47% | ✅ yes |
| `core` | `packages/core/src/fs/agent-fs.ts` | 13.39% | 0.0% | 0.0% | 4.46% | ✅ yes |
| `plugin-api` | `packages/plugin-api/src/composition.ts` | 13.43% | 0.0% | 0.0% | 4.48% | ✅ yes |
| `core` | `packages/core/src/fs/campaign-fs.ts` | 14.29% | 0.0% | 0.0% | 4.76% | ✅ yes |
| `permissions` | `packages/permissions/src/gates.ts` | 21.1% | 0.0% | 0.0% | 7.03% | ✅ yes |
| `core` | `packages/core/src/contract.ts` | 23.26% | 0.0% | 0.0% | 7.75% | ✅ yes |
| `mcp-server` | `packages/mcp-server/src/tools/glide-converge.ts` | 29.2% | 0.0% | 0.0% | 9.73% | ✅ yes |
| `core` | `packages/core/src/security/command-guard.ts` | 43.22% | 0.0% | 0.0% | 14.41% | ✅ yes |
| `mcp-server` | `packages/mcp-server/src/tools/glide-gates.ts` | 46.51% | 0.0% | 0.0% | 15.5% | ✅ yes |
| `core` | `packages/core/src/io/id.ts` | 50.0% | 0.0% | 0.0% | 16.67% | ✅ yes |
| `core` | `packages/core/src/ids.ts` | 52.0% | 0.0% | 0.0% | 17.33% | ✅ yes |
| `core` | `packages/core/src/fs/schemas.ts` | 78.05% | 0.0% | 0.0% | 26.02% | ✅ yes |
| `tracer` | `packages/tracer/src/jsonl-writer.ts` | 21.74% | 25.0% | 50.0% | 32.25% | ✅ yes |
| `executor` | `packages/executor/src/agent-status.ts` | 100.0% | 0.0% | 0.0% | 33.33% | ✅ yes |
| `tracer` | `packages/tracer/src/trace-runtime.ts` | 48.39% | 40.0% | 100.0% | 62.8% | ✅ yes |
| `executor` | `packages/executor/src/session.ts` | 64.08% | 42.86% | 81.82% | 62.92% | ✅ yes |
| `mcp-server` | `packages/mcp-server/src/server.ts` | 41.34% | 87.5% | 65.38% | 64.74% | ✅ yes |
| `plugin-api` | `packages/plugin-api/src/registry.ts` | 54.22% | 75.0% | 84.62% | 71.28% | ✅ yes |
| `plugin-api` | `packages/plugin-api/src/durability.ts` | 63.89% | 77.78% | 73.68% | 71.78% | ✅ yes |
| `headroom` | `packages/headroom/src/goal-store.ts` | 75.62% | 68.42% | 71.74% | 71.93% | ✅ yes |
| `executor` | `packages/executor/src/executor.ts` | 72.91% | 89.47% | 58.97% | 73.79% | ✅ yes |
| `headroom` | `packages/headroom/src/delta.ts` | 70.97% | 72.73% | 78.95% | 74.21% | ✅ yes |
| `headroom` | `packages/headroom/src/runtime.ts` | 87.79% | 70.59% | 75.0% | 77.79% | ✅ yes |
| `dashboard` | `packages/dashboard/src/live.ts` | 87.59% | 88.89% | 58.97% | 78.48% | ✅ yes |

## Zero / Untracked Coverage (0%)

| Package | File | Stmts | Funcs | Branches | Overall | Has Dedicated Test |
|---|---|---|---|---|---|---|
| `core` | `packages/core/src/context.test.ts` | 0.0% | 0.0% | 0.0% | 0.0% | ✅ yes |
| `core` | `packages/core/src/goal.ts` | 0.0% | 0.0% | 0.0% | 0.0% | ✅ yes |
| `core` | `packages/core/src/io.ts` | 0.0% | 0.0% | 0.0% | 0.0% | ✅ yes |
| `core` | `packages/core/src/campaign/schemas.ts` | 0.0% | 0.0% | 0.0% | 0.0% | ✅ yes |
| `executor` | `packages/executor/src/agent-handle.ts` | 0.0% | 0.0% | 0.0% | 0.0% | ✅ yes |
| `executor` | `packages/executor/src/agent-message.ts` | 0.0% | 0.0% | 0.0% | 0.0% | ✅ yes |
| `permissions` | `packages/permissions/src/capability-tokens.ts` | 0.0% | 0.0% | 0.0% | 0.0% | ✅ yes |

## Strong Coverage (≥80% Overall)

| Package | File | Stmts | Funcs | Branches | Overall | Has Dedicated Test |
|---|---|---|---|---|---|---|
| `mcp-server` | `packages/mcp-server/src/tools/glide-test-tools.ts` | 97.1% | 100.0% | 45.45% | 80.85% | ✅ yes |
| `tracer` | `packages/tracer/src/tracer.ts` | 90.76% | 66.67% | 86.21% | 81.21% | ✅ yes |
| `mcp-server` | `packages/mcp-server/src/tools/glide-graph.ts` | 80.62% | 100.0% | 64.86% | 81.83% | ✅ yes |
| `mcp-server` | `packages/mcp-server/src/tools/glide-build.ts` | 97.22% | 100.0% | 50.0% | 82.41% | ✅ yes |
| `headroom` | `packages/headroom/src/heartbeat.ts` | 85.61% | 92.31% | 71.43% | 83.12% | ✅ yes |
| `tracer` | `packages/tracer/src/graphify.ts` | 87.74% | 93.33% | 79.76% | 86.94% | ✅ yes |
| `plugin-api` | `packages/plugin-api/src/loader.ts` | 86.14% | 85.71% | 91.67% | 87.84% | ✅ yes |
| `mcp-server` | `packages/mcp-server/src/tools/glide-ship.ts` | 97.3% | 100.0% | 66.67% | 87.99% | ✅ yes |
| `executor` | `packages/executor/src/contract.ts` | 87.25% | 83.33% | 96.0% | 88.86% | ✅ yes |
| `mcp-server` | `packages/mcp-server/src/tools/glide-permissions.ts` | 89.74% | 100.0% | 76.92% | 88.89% | ✅ yes |
| `mcp-server` | `packages/mcp-server/src/tools/glide-headroom.ts` | 96.1% | 100.0% | 71.43% | 89.18% | ✅ yes |
| `permissions` | `packages/permissions/src/runtime.ts` | 92.31% | 83.33% | 92.31% | 89.32% | ✅ yes |
| `plugin-api` | `packages/plugin-api/src/session.ts` | 92.99% | 94.44% | 81.08% | 89.51% | ✅ yes |
| `mcp-server` | `packages/mcp-server/src/tools/glide-executor.ts` | 100.0% | 100.0% | 73.68% | 91.23% | ✅ yes |
| `core` | `packages/core/src/constitution.ts` | 93.29% | 100.0% | 84.38% | 92.55% | ✅ yes |
| `mcp-server` | `packages/mcp-server/src/bridge/HostBridge.ts` | 97.03% | 100.0% | 82.61% | 93.21% | ✅ yes |
| `executor` | `packages/executor/src/program.ts` | 97.86% | 100.0% | 82.02% | 93.29% | ✅ yes |
| `executor` | `packages/executor/src/runtime.ts` | 100.0% | 100.0% | 80.95% | 93.65% | ✅ yes |
| `dashboard` | `packages/dashboard/src/generator.ts` | 97.62% | 100.0% | 83.33% | 93.65% | ✅ yes |
| `mcp-server` | `packages/mcp-server/src/tools/glide-status.ts` | 100.0% | 100.0% | 85.71% | 95.24% | ✅ yes |
| `mcp-server` | `packages/mcp-server/src/tools/glide-review.ts` | 100.0% | 100.0% | 87.5% | 95.83% | ✅ yes |
| `headroom` | `packages/headroom/src/roles.ts` | 98.34% | 100.0% | 91.89% | 96.74% | ✅ yes |
| `mcp-server` | `packages/mcp-server/src/tools/glide-tracer.ts` | 100.0% | 100.0% | 90.91% | 96.97% | ✅ yes |
| `headroom` | `packages/headroom/src/converge.ts` | 99.44% | 100.0% | 92.31% | 97.25% | ✅ yes |
| `headroom` | `packages/headroom/src/headroom.ts` | 100.0% | 100.0% | 95.65% | 98.55% | ✅ yes |
| `mcp-server` | `packages/mcp-server/src/tools/glide-goal.ts` | 100.0% | 100.0% | 100.0% | 100.0% | ✅ yes |
| `mcp-server` | `packages/mcp-server/src/tools/glide-indepth.ts` | 100.0% | 100.0% | 100.0% | 100.0% | ✅ yes |
| `mcp-server` | `packages/mcp-server/src/tools/glide-plan.ts` | 100.0% | 100.0% | 100.0% | 100.0% | ✅ yes |
| `mcp-server` | `packages/mcp-server/src/tools/glide-trace.ts` | 100.0% | 100.0% | 100.0% | 100.0% | ✅ yes |
| `permissions` | `packages/permissions/src/permissions.ts` | 100.0% | 100.0% | 100.0% | 100.0% | ✅ yes |

---

## Uncovered Critical Paths by File

### `packages/core/src/campaign/schemas.ts`

- **Package**: `core`
- **Coverage**: statements 0.0%, functions 0.0%, branches 0.0%, overall 0.0%
- **Uncovered lines**: 1, 7-13, 17-23, 25-42, 46-55, 63-66, 74-79, 81-88, 92-100, 102-116, 120-126, 130-143, 151-162
- **Uncovered branches** (line : type : count): 1:branch:1
- **Dedicated test file**: yes

### `packages/core/src/context.test.ts`

- **Package**: `core`
- **Coverage**: statements 0.0%, functions 0.0%, branches 0.0%, overall 0.0%
- **Uncovered lines**: 1-4, 7-10, 12-16, 18-22, 24-28, 30-32, 34, 36-42, 44-46, 48-49, 51-54, 56-58, 60-64
- **Uncovered branches** (line : type : count): 1:branch:1
- **Dedicated test file**: yes

### `packages/core/src/contract.ts`

- **Package**: `core`
- **Coverage**: statements 23.26%, functions 0.0%, branches 0.0%, overall 7.75%
- **Uncovered lines**: 41-49, 51-53, 55-64, 71-72, 74-80, 82-83
- **Dedicated test file**: yes

### `packages/core/src/fs/agent-fs.ts`

- **Package**: `core`
- **Coverage**: statements 13.39%, functions 0.0%, branches 0.0%, overall 4.46%
- **Uncovered lines**: 23-24, 27-28, 31-33, 35-40, 42-56, 58-64, 67-68, 70-77, 80-88, 90-91, 94-105, 108-118, 121-123, 125-152
- **Dedicated test file**: yes

### `packages/core/src/fs/campaign-fs.ts`

- **Package**: `core`
- **Coverage**: statements 14.29%, functions 0.0%, branches 0.0%, overall 4.76%
- **Uncovered lines**: 5-8, 10-17
- **Dedicated test file**: yes

### `packages/core/src/fs/schemas.ts`

- **Package**: `core`
- **Coverage**: statements 78.05%, functions 0.0%, branches 0.0%, overall 26.02%
- **Uncovered lines**: 108-113, 116-121, 124-129
- **Dedicated test file**: yes

### `packages/core/src/goal.ts`

- **Package**: `core`
- **Coverage**: statements 0.0%, functions 0.0%, branches 0.0%, overall 0.0%
- **Dedicated test file**: yes

### `packages/core/src/ids.ts`

- **Package**: `core`
- **Coverage**: statements 52.0%, functions 0.0%, branches 0.0%, overall 17.33%
- **Uncovered lines**: 12-13, 16-17, 20-21, 24-25, 28-29, 32-33
- **Dedicated test file**: yes

### `packages/core/src/io.ts`

- **Package**: `core`
- **Coverage**: statements 0.0%, functions 0.0%, branches 0.0%, overall 0.0%
- **Uncovered lines**: 1
- **Uncovered branches** (line : type : count): 1:branch:1
- **Dedicated test file**: yes

### `packages/core/src/io/atomic-write.ts`

- **Package**: `core`
- **Coverage**: statements 6.67%, functions 0.0%, branches 0.0%, overall 2.22%
- **Uncovered lines**: 10-13, 15-24, 27-36, 38-41, 49-52, 54-64, 66-75, 77-80, 86-91, 97-103
- **Dedicated test file**: yes

### `packages/core/src/io/id.ts`

- **Package**: `core`
- **Coverage**: statements 50.0%, functions 0.0%, branches 0.0%, overall 16.67%
- **Uncovered lines**: 17-18, 21-22, 25-26, 29-30, 33-34, 37-38, 41-42, 45-46, 49-50, 53-54, 57-58
- **Dedicated test file**: yes

### `packages/core/src/security/command-guard.ts`

- **Package**: `core`
- **Coverage**: statements 43.22%, functions 0.0%, branches 0.0%, overall 14.41%
- **Uncovered lines**: 11-17, 67-72, 74-78, 80-82, 84-89, 91-92, 94-98, 100-101, 103-105, 107-109, 111-112, 115-117, 119-125, 127, 129-140
- **Dedicated test file**: yes

### `packages/core/src/security/path-guard.ts`

- **Package**: `core`
- **Coverage**: statements 7.41%, functions 0.0%, branches 0.0%, overall 2.47%
- **Uncovered lines**: 21-27, 30-33, 35-39, 41-60, 62-64, 67-72, 74-75, 77-82, 84-89, 91-97, 99-101, 103-106, 109-110
- **Dedicated test file**: yes

### `packages/dashboard/src/live.ts`

- **Package**: `dashboard`
- **Coverage**: statements 87.59%, functions 88.89%, branches 58.97%, overall 78.48%
- **Uncovered lines**: 64, 66-67, 69-70, 117-118, 136-137, 151-152, 192-198
- **Uncovered branches** (line : type : count): 59:branch:1, 60:branch:1, 63:branch:1, 65:branch:1, 68:branch:1, 82:branch:1, 116:branch:1, 122:branch:1, 123:branch:1, 124:branch:1...
- **Dedicated test file**: yes

### `packages/executor/src/agent-handle.ts`

- **Package**: `executor`
- **Coverage**: statements 0.0%, functions 0.0%, branches 0.0%, overall 0.0%
- **Dedicated test file**: yes

### `packages/executor/src/agent-message.ts`

- **Package**: `executor`
- **Coverage**: statements 0.0%, functions 0.0%, branches 0.0%, overall 0.0%
- **Dedicated test file**: yes

### `packages/executor/src/agent-status.ts`

- **Package**: `executor`
- **Coverage**: statements 100.0%, functions 0.0%, branches 0.0%, overall 33.33%
- **Dedicated test file**: yes

### `packages/executor/src/executor.ts`

- **Package**: `executor`
- **Coverage**: statements 72.91%, functions 89.47%, branches 58.97%, overall 73.79%
- **Uncovered lines**: 14-15, 21-22, 28-29, 55-56, 61, 102, 106-107, 109-112, 114-120, 122, 202, 230, 237, 244, 255, 266-267, 272-274, 276, 292-299, 334...
- **Uncovered branches** (line : type : count): 13:branch:1, 20:branch:1, 27:branch:1, 52:branch:1, 54:branch:1, 54:branch:1, 59:branch:1, 100:branch:1, 103:branch:1, 104:branch:1...
- **Dedicated test file**: yes

### `packages/executor/src/session.ts`

- **Package**: `executor`
- **Coverage**: statements 64.08%, functions 42.86%, branches 81.82%, overall 62.92%
- **Uncovered lines**: 84-85, 88-93, 96-98, 101-105, 107-110, 112-123, 125-127, 129-130, 132-133, 144-148, 151-152, 168-172, 175-188, 191-192, 195-196, 271-272, 275-276, 280
- **Uncovered branches** (line : type : count): 70:branch:1, 70:branch:1, 70:branch:1, 71:branch:1, 71:branch:1, 210:branch:1
- **Dedicated test file**: yes

### `packages/headroom/src/delta.ts`

- **Package**: `headroom`
- **Coverage**: statements 70.97%, functions 72.73%, branches 78.95%, overall 74.21%
- **Uncovered lines**: 73-76, 101-105, 117, 119-120, 132, 148, 154-166
- **Uncovered branches** (line : type : count): 115:branch:1, 118:branch:1, 130:branch:1, 146:branch:1
- **Dedicated test file**: yes

### `packages/headroom/src/goal-store.ts`

- **Package**: `headroom`
- **Coverage**: statements 75.62%, functions 68.42%, branches 71.74%, overall 71.93%
- **Uncovered lines**: 16-17, 37-41, 45-56, 120-121, 142-143, 223-224, 226-228, 230-231, 234, 236-238, 240-241, 243-244, 248, 250-259
- **Uncovered branches** (line : type : count): 15:branch:1, 72:branch:1, 77:branch:1, 77:branch:1, 78:branch:1, 78:branch:1, 97:branch:1, 119:branch:1, 125:branch:1, 135:branch:1...
- **Dedicated test file**: yes

### `packages/headroom/src/runtime.ts`

- **Package**: `headroom`
- **Coverage**: statements 87.79%, functions 70.59%, branches 75.0%, overall 77.79%
- **Uncovered lines**: 75-77, 80-81, 84-85, 88-89, 171-177, 207-211
- **Uncovered branches** (line : type : count): 92:branch:1, 109:branch:1, 111:branch:1, 111:branch:1, 187:branch:1, 201:branch:1, 206:branch:1, 218:branch:1
- **Dedicated test file**: yes

### `packages/mcp-server/src/server.ts`

- **Package**: `mcp-server`
- **Coverage**: statements 41.34%, functions 87.5%, branches 65.38%, overall 64.74%
- **Uncovered lines**: 64-65, 78-88, 95-105, 121-125, 127-130, 132-145, 147-151, 153-170, 172-186, 188-200, 202-211, 213-236, 238-247, 252-253, 266-267, 269, 278-284, 288, 292, 296...
- **Uncovered branches** (line : type : count): 317:branch:1, 30:branch:1, 63:branch:1, 77:branch:1, 94:branch:1, 120:branch:1, 265:branch:1, 268:branch:1, 274:branch:1
- **Dedicated test file**: yes

### `packages/mcp-server/src/tools/glide-converge.ts`

- **Package**: `mcp-server`
- **Coverage**: statements 29.2%, functions 0.0%, branches 0.0%, overall 9.73%
- **Uncovered lines**: 42-45, 47, 49-55, 57, 59-80, 82-97, 100, 106-114, 116-126, 128-133, 135-136
- **Dedicated test file**: yes

### `packages/mcp-server/src/tools/glide-gates.ts`

- **Package**: `mcp-server`
- **Coverage**: statements 46.51%, functions 0.0%, branches 0.0%, overall 15.5%
- **Uncovered lines**: 24-27, 29-32, 34, 36-49
- **Dedicated test file**: yes

### `packages/permissions/src/capability-tokens.ts`

- **Package**: `permissions`
- **Coverage**: statements 0.0%, functions 0.0%, branches 0.0%, overall 0.0%
- **Uncovered lines**: 1, 34-43, 45-50, 52-59, 61-68, 70-73, 75-79, 81-84, 86-88, 90-92, 94-96, 98-103, 105-117, 119-124, 126-134, 136-137, 139-141, 143, 145-151, 153-156...
- **Uncovered branches** (line : type : count): 1:branch:1
- **Dedicated test file**: yes

### `packages/permissions/src/gates.ts`

- **Package**: `permissions`
- **Coverage**: statements 21.1%, functions 0.0%, branches 0.0%, overall 7.03%
- **Uncovered lines**: 27-28, 31-48, 52-54, 57-59, 61-64, 66-79, 84-85, 87-94, 96-97, 99, 101-109, 115, 117-124, 126-127, 129-136, 138-144, 150-153, 155-156, 158-167, 169-175...
- **Uncovered branches** (line : type : count): 24:branch:1, 254:branch:1
- **Dedicated test file**: yes

### `packages/plugin-api/src/composition.ts`

- **Package**: `plugin-api`
- **Coverage**: statements 13.43%, functions 0.0%, branches 0.0%, overall 4.48%
- **Uncovered lines**: 73-79, 84-85, 88-93, 95-96, 99-104, 106-107, 110-115, 117-118, 121-122, 125-126, 129-130, 133-134, 137-138, 141-142, 145-146, 150-157, 159-161, 163-170, 172-175, 177-179...
- **Uncovered branches** (line : type : count): 83:branch:1
- **Dedicated test file**: yes

### `packages/plugin-api/src/durability.ts`

- **Package**: `plugin-api`
- **Coverage**: statements 63.89%, functions 77.78%, branches 73.68%, overall 71.78%
- **Uncovered lines**: 65-66, 72, 80, 101-103, 105-113, 115, 117-121, 124-126, 128, 130-135, 138-140, 142-145
- **Uncovered branches** (line : type : count): 24:branch:1, 42:branch:1, 64:branch:1, 70:branch:1, 78:branch:1
- **Dedicated test file**: yes

### `packages/plugin-api/src/registry.ts`

- **Package**: `plugin-api`
- **Coverage**: statements 54.22%, functions 75.0%, branches 84.62%, overall 71.28%
- **Uncovered lines**: 35, 65-68, 70-82, 84-100, 103-105
- **Uncovered branches** (line : type : count): 26:branch:1, 34:branch:1
- **Dedicated test file**: yes

### `packages/tracer/src/jsonl-writer.ts`

- **Package**: `tracer`
- **Coverage**: statements 21.74%, functions 25.0%, branches 50.0%, overall 32.25%
- **Uncovered lines**: 39-43, 45-48, 50-53, 56-58, 60-66, 68-71, 74-79, 83-84, 87-94, 96-97, 100-104, 106-109, 111-121, 123-125, 127-128, 130-131
- **Uncovered branches** (line : type : count): 32:branch:1, 33:branch:1
- **Dedicated test file**: yes

### `packages/tracer/src/trace-runtime.ts`

- **Package**: `tracer`
- **Coverage**: statements 48.39%, functions 40.0%, branches 100.0%, overall 62.8%
- **Uncovered lines**: 34-45, 48-49, 52-53
- **Dedicated test file**: yes

---

## Priority Recommendations

### P0 — Add tests for 0% covered files

_All 0% files have at least one package-level test; still need targeted test files._

### P1 — Strengthen weak coverage files

- `packages/core/src/io/atomic-write.ts` — overall 2.22% — ✅ has package-level test; add cases for uncovered branches/error paths
- `packages/core/src/security/path-guard.ts` — overall 2.47% — ✅ has package-level test; add cases for uncovered branches/error paths
- `packages/core/src/fs/agent-fs.ts` — overall 4.46% — ✅ has package-level test; add cases for uncovered branches/error paths
- `packages/plugin-api/src/composition.ts` — overall 4.48% — ✅ has package-level test; add cases for uncovered branches/error paths
- `packages/core/src/fs/campaign-fs.ts` — overall 4.76% — ✅ has package-level test; add cases for uncovered branches/error paths
- `packages/permissions/src/gates.ts` — overall 7.03% — ✅ has package-level test; add cases for uncovered branches/error paths
- `packages/core/src/contract.ts` — overall 7.75% — ✅ has package-level test; add cases for uncovered branches/error paths
- `packages/mcp-server/src/tools/glide-converge.ts` — overall 9.73% — ✅ has package-level test; add cases for uncovered branches/error paths
- `packages/core/src/security/command-guard.ts` — overall 14.41% — ✅ has package-level test; add cases for uncovered branches/error paths
- `packages/mcp-server/src/tools/glide-gates.ts` — overall 15.5% — ✅ has package-level test; add cases for uncovered branches/error paths
- `packages/core/src/io/id.ts` — overall 16.67% — ✅ has package-level test; add cases for uncovered branches/error paths
- `packages/core/src/ids.ts` — overall 17.33% — ✅ has package-level test; add cases for uncovered branches/error paths
- `packages/core/src/fs/schemas.ts` — overall 26.02% — ✅ has package-level test; add cases for uncovered branches/error paths
- `packages/tracer/src/jsonl-writer.ts` — overall 32.25% — ✅ has package-level test; add cases for uncovered branches/error paths
- `packages/executor/src/agent-status.ts` — overall 33.33% — ✅ has package-level test; add cases for uncovered branches/error paths
- `packages/tracer/src/trace-runtime.ts` — overall 62.8% — ✅ has package-level test; add cases for uncovered branches/error paths
- `packages/executor/src/session.ts` — overall 62.92% — ✅ has package-level test; add cases for uncovered branches/error paths
- `packages/mcp-server/src/server.ts` — overall 64.74% — ✅ has package-level test; add cases for uncovered branches/error paths
- `packages/plugin-api/src/registry.ts` — overall 71.28% — ✅ has package-level test; add cases for uncovered branches/error paths
- `packages/plugin-api/src/durability.ts` — overall 71.78% — ✅ has package-level test; add cases for uncovered branches/error paths
- `packages/headroom/src/goal-store.ts` — overall 71.93% — ✅ has package-level test; add cases for uncovered branches/error paths
- `packages/executor/src/executor.ts` — overall 73.79% — ✅ has package-level test; add cases for uncovered branches/error paths
- `packages/headroom/src/delta.ts` — overall 74.21% — ✅ has package-level test; add cases for uncovered branches/error paths
- `packages/headroom/src/runtime.ts` — overall 77.79% — ✅ has package-level test; add cases for uncovered branches/error paths
- `packages/dashboard/src/live.ts` — overall 78.48% — ✅ has package-level test; add cases for uncovered branches/error paths

### P2 — Missing test files

- `packages/core/src/campaign/schemas.ts` — suggestion: create dedicated `schemas.test.ts`
- `packages/core/src/context.test.ts` — suggestion: create dedicated `context.test.test.ts`
- `packages/core/src/fs/agent-fs.ts` — suggestion: create dedicated `agent-fs.test.ts`
- `packages/core/src/fs/campaign-fs.ts` — suggestion: create dedicated `campaign-fs.test.ts`
- `packages/core/src/fs/schemas.ts` — suggestion: create dedicated `schemas.test.ts`
- `packages/core/src/io/atomic-write.ts` — suggestion: create dedicated `atomic-write.test.ts`
- `packages/core/src/security/command-guard.ts` — suggestion: create dedicated `command-guard.test.ts`
- `packages/core/src/security/path-guard.ts` — suggestion: create dedicated `path-guard.test.ts`
- `packages/executor/src/agent-message.ts` — suggestion: create dedicated `agent-message.test.ts`
- `packages/executor/src/program.ts` — suggestion: create dedicated `program.test.ts`
- `packages/headroom/src/converge.ts` — suggestion: create dedicated `converge.test.ts`
- `packages/mcp-server/src/tools/glide-build.ts` — suggestion: create dedicated `glide-build.test.ts`
- `packages/mcp-server/src/tools/glide-converge.ts` — suggestion: create dedicated `glide-converge.test.ts`
- `packages/mcp-server/src/tools/glide-gates.ts` — suggestion: create dedicated `glide-gates.test.ts`
- `packages/mcp-server/src/tools/glide-goal.ts` — suggestion: create dedicated `glide-goal.test.ts`
- `packages/mcp-server/src/tools/glide-graph.ts` — suggestion: create dedicated `glide-graph.test.ts`
- `packages/mcp-server/src/tools/glide-headroom.ts` — suggestion: create dedicated `glide-headroom.test.ts`
- `packages/mcp-server/src/tools/glide-indepth.ts` — suggestion: create dedicated `glide-indepth.test.ts`
- `packages/mcp-server/src/tools/glide-permissions.ts` — suggestion: create dedicated `glide-permissions.test.ts`
- `packages/mcp-server/src/tools/glide-plan.ts` — suggestion: create dedicated `glide-plan.test.ts`
- `packages/mcp-server/src/tools/glide-review.ts` — suggestion: create dedicated `glide-review.test.ts`
- `packages/mcp-server/src/tools/glide-ship.ts` — suggestion: create dedicated `glide-ship.test.ts`
- `packages/mcp-server/src/tools/glide-status.ts` — suggestion: create dedicated `glide-status.test.ts`
- `packages/mcp-server/src/tools/glide-test-tools.ts` — suggestion: create dedicated `glide-test-tools.test.ts`
- `packages/permissions/src/capability-tokens.ts` — suggestion: create dedicated `capability-tokens.test.ts`
- `packages/permissions/src/gates.ts` — suggestion: create dedicated `gates.test.ts`
- `packages/plugin-api/src/composition.ts` — suggestion: create dedicated `composition.test.ts`
- `packages/tracer/src/graphify.ts` — suggestion: create dedicated `graphify.test.ts`
- `packages/tracer/src/jsonl-writer.ts` — suggestion: create dedicated `jsonl-writer.test.ts`
- `packages/tracer/src/trace-runtime.ts` — suggestion: create dedicated `trace-runtime.test.ts`

### P3 — Suggested targeted test cases by package

#### `core`

- **packages/core/src/campaign/schemas.ts**:
  - Cover lines 1, 7, 8, 9, 10, 11, 12, 13, 17, 18
  - Cover branches at lines 1

- **packages/core/src/context.test.ts**:
  - Cover lines 1, 2, 3, 4, 7, 8, 9, 10, 12, 13
  - Cover branches at lines 1

- **packages/core/src/contract.ts**:
  - Cover lines 41, 42, 43, 44, 45, 46, 47, 48, 49, 51

- **packages/core/src/fs/agent-fs.ts**:
  - Cover lines 23, 24, 27, 28, 31, 32, 33, 35, 36, 37

- **packages/core/src/fs/campaign-fs.ts**:
  - Cover lines 5, 6, 7, 8, 10, 11, 12, 13, 14, 15

- **packages/core/src/fs/schemas.ts**:
  - Cover lines 108, 109, 110, 111, 112, 113, 116, 117, 118, 119

- **packages/core/src/goal.ts**:

- **packages/core/src/ids.ts**:
  - Cover lines 12, 13, 16, 17, 20, 21, 24, 25, 28, 29

- **packages/core/src/io.ts**:
  - Cover lines 1
  - Cover branches at lines 1

- **packages/core/src/io/atomic-write.ts**:
  - Cover lines 10, 11, 12, 13, 15, 16, 17, 18, 19, 20

- **packages/core/src/io/id.ts**:
  - Cover lines 17, 18, 21, 22, 25, 26, 29, 30, 33, 34

- **packages/core/src/security/command-guard.ts**:
  - Cover lines 11, 12, 13, 14, 15, 16, 17, 67, 68, 69

- **packages/core/src/security/path-guard.ts**:
  - Cover lines 21, 22, 23, 24, 25, 26, 27, 30, 31, 32

#### `dashboard`

- **packages/dashboard/src/live.ts**:
  - Cover lines 64, 66, 67, 69, 70, 117, 118, 136, 137, 151
  - Cover branches at lines 59, 60, 63, 65, 68

#### `executor`

- **packages/executor/src/agent-handle.ts**:

- **packages/executor/src/agent-message.ts**:

- **packages/executor/src/agent-status.ts**:

- **packages/executor/src/executor.ts**:
  - Cover lines 14, 15, 21, 22, 28, 29, 55, 56, 61, 102
  - Cover branches at lines 13, 20, 27, 52, 54

- **packages/executor/src/session.ts**:
  - Cover lines 84, 85, 88, 89, 90, 91, 92, 93, 96, 97
  - Cover branches at lines 70, 70, 70, 71, 71

#### `headroom`

- **packages/headroom/src/delta.ts**:
  - Cover lines 73, 74, 75, 76, 101, 102, 103, 104, 105, 117
  - Cover branches at lines 115, 118, 130, 146

- **packages/headroom/src/goal-store.ts**:
  - Cover lines 16, 17, 37, 38, 39, 40, 41, 45, 46, 47
  - Cover branches at lines 15, 72, 77, 77, 78

- **packages/headroom/src/runtime.ts**:
  - Cover lines 75, 76, 77, 80, 81, 84, 85, 88, 89, 171
  - Cover branches at lines 92, 109, 111, 111, 187

#### `mcp-server`

- **packages/mcp-server/src/server.ts**:
  - Cover lines 64, 65, 78, 79, 80, 81, 82, 83, 84, 85
  - Cover branches at lines 317, 30, 63, 77, 94

- **packages/mcp-server/src/tools/glide-converge.ts**:
  - Cover lines 42, 43, 44, 45, 47, 49, 50, 51, 52, 53

- **packages/mcp-server/src/tools/glide-gates.ts**:
  - Cover lines 24, 25, 26, 27, 29, 30, 31, 32, 34, 36

#### `permissions`

- **packages/permissions/src/capability-tokens.ts**:
  - Cover lines 1, 34, 35, 36, 37, 38, 39, 40, 41, 42
  - Cover branches at lines 1

- **packages/permissions/src/gates.ts**:
  - Cover lines 27, 28, 31, 32, 33, 34, 35, 36, 37, 38
  - Cover branches at lines 24, 254

#### `plugin-api`

- **packages/plugin-api/src/composition.ts**:
  - Cover lines 73, 74, 75, 76, 77, 78, 79, 84, 85, 88
  - Cover branches at lines 83

- **packages/plugin-api/src/durability.ts**:
  - Cover lines 65, 66, 72, 80, 101, 102, 103, 105, 106, 107
  - Cover branches at lines 24, 42, 64, 70, 78

- **packages/plugin-api/src/registry.ts**:
  - Cover lines 35, 65, 66, 67, 68, 70, 71, 72, 73, 74
  - Cover branches at lines 26, 34

#### `tracer`

- **packages/tracer/src/jsonl-writer.ts**:
  - Cover lines 39, 40, 41, 42, 43, 45, 46, 47, 48, 50
  - Cover branches at lines 32, 33

- **packages/tracer/src/trace-runtime.ts**:
  - Cover lines 34, 35, 36, 37, 38, 39, 40, 41, 42, 43

---

## Overall Package Coverage Summary

| Package | Avg Stmts | Avg Funcs | Avg Branches | Files |
|---|---|---|---|---|
| `core` | 27.26% | 7.14% | 6.03% | 14 |
| `dashboard` | 92.61% | 94.44% | 71.15% | 2 |
| `executor` | 65.26% | 51.96% | 49.97% | 8 |
| `headroom` | 88.25% | 86.29% | 82.42% | 7 |
| `mcp-server` | 87.34% | 88.19% | 70.06% | 18 |
| `permissions` | 53.35% | 45.83% | 48.08% | 4 |
| `plugin-api` | 62.13% | 66.59% | 66.21% | 5 |
| `tracer` | 62.16% | 56.25% | 78.99% | 4 |

---

## Notes

- Coverage data sourced from `vitest --coverage` with `@vitest/coverage-v8`.
- Coverage thresholds in `vitest.config.ts`: 80% for lines, functions, branches, statements.
- Excluded from coverage: CLI entrypoints, plugins, `.d.ts`, `types.ts`, `index.ts`.
- Report generated for branch `main`.
