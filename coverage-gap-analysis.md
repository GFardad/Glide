# Test Coverage Gap Analysis

Generated from coverage-final.json and source tree.

## Summary

- Tracked source files: 49
- 0% / untracked: 3
- Weak coverage (<80% overall): 13
- Strong coverage (≥80%): 33
- Test files mapped: 2
- Packages: 8



## Weak Coverage (<80%)
| Package | File | Stmts | Funcs | Branches | Overall | Test File |
|---|---|---|---|---|---|---|
| tracer | jsonl-writer.ts | 11.11% | 0% | 0% | 3.7% | missing |
| plugin-api | composition.ts | 12.88% | 0% | 0% | 4.29% | missing |
| permissions | gates.ts | 18.23% | 0% | 0% | 6.08% | missing |
| mcp-server | glide-converge.ts | 26.85% | 0% | 0% | 8.95% | missing |
| tracer | trace-runtime.ts | 37.5% | 0% | 0% | 12.5% | missing |
| mcp-server | glide-gates.ts | 46.51% | 0% | 0% | 15.5% | missing |
| executor | agent-status.ts | 100% | 0% | 0% | 33.33% | missing |
| mcp-server | server.ts | 40.29% | 87.5% | 65.38% | 64.39% | missing |
| tracer | tracer.ts | 84.3% | 36.36% | 84.62% | 68.43% | missing |
| executor | session.ts | 74.81% | 54.55% | 89.29% | 72.88% | missing |
| headroom | delta.ts | 70.97% | 72.73% | 80% | 74.57% | missing |
| plugin-api | durability.ts | 70.53% | 77.78% | 80% | 76.1% | missing |
| dashboard | live.ts | 87.59% | 88.89% | 58.97% | 78.48% | missing |

## Zero / Untracked Coverage
| Package | File | Stmts | Funcs | Branches | Overall | Test File |
|---|---|---|---|---|---|---|
| core | goal.ts | 0% | 0% | 0% | 0% | missing |
| executor | agent-handle.ts | 0% | 0% | 0% | 0% | missing |
| executor | agent-message.ts | 0% | 0% | 0% | 0% | missing |

## Strong Coverage (≥80%)
| Package | File | Stmts | Funcs | Branches | Overall | Test File |
|---|---|---|---|---|---|---|
| mcp-server | glide-test-tools.ts | 96.88% | 100% | 45.45% | 80.78% | missing |
| mcp-server | glide-graph.ts | 80.63% | 100% | 64.86% | 81.83% | missing |
| mcp-server | glide-build.ts | 97.01% | 100% | 50% | 82.34% | missing |
| tracer | graphify.ts | 87.74% | 93.33% | 79.76% | 86.94% | missing |
| headroom | heartbeat.ts | 89.17% | 100% | 71.88% | 87.02% | missing |
| executor | executor.ts | 91.62% | 100% | 70.91% | 87.51% | missing |
| mcp-server | glide-ship.ts | 97.1% | 100% | 66.67% | 87.92% | missing |
| headroom | runtime.ts | 93.08% | 90% | 82.61% | 88.56% | missing |
| mcp-server | glide-headroom.ts | 96.1% | 100% | 71.43% | 89.18% | missing |
| plugin-api | session.ts | 94.12% | 94.44% | 83.33% | 90.63% | missing |
| permissions | runtime.ts | 92.16% | 100% | 80% | 90.72% | missing |
| mcp-server | glide-executor.ts | 100% | 100% | 73.68% | 91.23% | missing |
| mcp-server | HostBridge.ts | 97.03% | 100% | 82.61% | 93.21% | missing |
| executor | program.ts | 97.86% | 100% | 82.02% | 93.29% | missing |
| executor | runtime.ts | 100% | 100% | 80.95% | 93.65% | missing |
| core | constitution.ts | 97.16% | 100% | 87.1% | 94.75% | missing |
| headroom | goal-store.ts | 98.6% | 100% | 86.84% | 95.15% | missing |
| mcp-server | glide-status.ts | 100% | 100% | 85.71% | 95.24% | missing |
| mcp-server | glide-review.ts | 100% | 100% | 87.5% | 95.83% | missing |
| mcp-server | glide-tracer.ts | 100% | 100% | 88.89% | 96.3% | missing |
| headroom | roles.ts | 98.34% | 100% | 91.89% | 96.74% | missing |
| headroom | converge.ts | 99.44% | 100% | 92.31% | 97.25% | missing |
| mcp-server | glide-trace.ts | 92.94% | 100% | 100% | 97.65% | missing |
| headroom | headroom.ts | 100% | 100% | 95.65% | 98.55% | missing |
| dashboard | generator.ts | 100% | 100% | 100% | 100% | missing |
| executor | contract.ts | 100% | 100% | 100% | 100% | missing |
| mcp-server | glide-goal.ts | 100% | 100% | 100% | 100% | missing |
| mcp-server | glide-indepth.ts | 100% | 100% | 100% | 100% | missing |
| mcp-server | glide-permissions.ts | 100% | 100% | 100% | 100% | missing |
| mcp-server | glide-plan.ts | 100% | 100% | 100% | 100% | missing |
| permissions | permissions.ts | 100% | 100% | 100% | 100% | missing |
| plugin-api | loader.ts | 100% | 100% | 100% | 100% | missing |
| plugin-api | registry.ts | 100% | 100% | 100% | 100% | missing |

## Priority Recommendations
### P0 — Add tests for 0% covered files
- `packages/core/src/goal.ts` — suggestion: add unit test covering main exported symbols in packages/core/src/goal.ts
- `packages/executor/src/agent-handle.ts` — suggestion: add unit test covering main exported symbols in packages/executor/src/agent-handle.ts
- `packages/executor/src/agent-message.ts` — suggestion: add unit test covering main exported symbols in packages/executor/src/agent-message.ts

### P1 — Strengthen weak coverage files
- `packages/dashboard/src/live.ts` — overall 78.48% — suggestion: add cases for uncovered branches/error paths
- `packages/executor/src/agent-status.ts` — overall 33.33% — suggestion: add cases for uncovered branches/error paths
- `packages/executor/src/session.ts` — overall 72.88% — suggestion: add cases for uncovered branches/error paths
- `packages/headroom/src/delta.ts` — overall 74.57% — suggestion: add cases for uncovered branches/error paths
- `packages/mcp-server/src/server.ts` — overall 64.39% — suggestion: add cases for uncovered branches/error paths
- `packages/mcp-server/src/tools/glide-converge.ts` — overall 8.95% — suggestion: add cases for uncovered branches/error paths
- `packages/mcp-server/src/tools/glide-gates.ts` — overall 15.5% — suggestion: add cases for uncovered branches/error paths
- `packages/permissions/src/gates.ts` — overall 6.08% — suggestion: add cases for uncovered branches/error paths
- `packages/plugin-api/src/composition.ts` — overall 4.29% — suggestion: add cases for uncovered branches/error paths
- `packages/plugin-api/src/durability.ts` — overall 76.1% — suggestion: add cases for uncovered branches/error paths
- `packages/tracer/src/jsonl-writer.ts` — overall 3.7% — suggestion: add cases for uncovered branches/error paths
- `packages/tracer/src/trace-runtime.ts` — overall 12.5% — suggestion: add cases for uncovered branches/error paths
- `packages/tracer/src/tracer.ts` — overall 68.43% — suggestion: add cases for uncovered branches/error paths

### P2 — Missing test files
- `packages/core/src/constitution.ts` — suggestion: create `missing`
- `packages/core/src/goal.ts` — suggestion: create `missing`
- `packages/dashboard/src/generator.ts` — suggestion: create `missing`
- `packages/dashboard/src/live.ts` — suggestion: create `missing`
- `packages/executor/src/agent-handle.ts` — suggestion: create `missing`
- `packages/executor/src/agent-message.ts` — suggestion: create `missing`
- `packages/executor/src/agent-status.ts` — suggestion: create `missing`
- `packages/executor/src/contract.ts` — suggestion: create `missing`
- `packages/executor/src/executor.ts` — suggestion: create `missing`
- `packages/executor/src/program.ts` — suggestion: create `missing`
- `packages/executor/src/runtime.ts` — suggestion: create `missing`
- `packages/executor/src/session.ts` — suggestion: create `missing`
- `packages/headroom/src/converge.ts` — suggestion: create `missing`
- `packages/headroom/src/delta.ts` — suggestion: create `missing`
- `packages/headroom/src/goal-store.ts` — suggestion: create `missing`
- `packages/headroom/src/headroom.ts` — suggestion: create `missing`
- `packages/headroom/src/heartbeat.ts` — suggestion: create `missing`
- `packages/headroom/src/roles.ts` — suggestion: create `missing`
- `packages/headroom/src/runtime.ts` — suggestion: create `missing`
- `packages/mcp-server/src/server.ts` — suggestion: create `missing`
- `packages/mcp-server/src/bridge/HostBridge.ts` — suggestion: create `missing`
- `packages/mcp-server/src/tools/glide-build.ts` — suggestion: create `missing`
- `packages/mcp-server/src/tools/glide-converge.ts` — suggestion: create `missing`
- `packages/mcp-server/src/tools/glide-executor.ts` — suggestion: create `missing`
- `packages/mcp-server/src/tools/glide-gates.ts` — suggestion: create `missing`
- `packages/mcp-server/src/tools/glide-goal.ts` — suggestion: create `missing`
- `packages/mcp-server/src/tools/glide-graph.ts` — suggestion: create `missing`
- `packages/mcp-server/src/tools/glide-headroom.ts` — suggestion: create `missing`
- `packages/mcp-server/src/tools/glide-indepth.ts` — suggestion: create `missing`
- `packages/mcp-server/src/tools/glide-permissions.ts` — suggestion: create `missing`
- `packages/mcp-server/src/tools/glide-plan.ts` — suggestion: create `missing`
- `packages/mcp-server/src/tools/glide-review.ts` — suggestion: create `missing`
- `packages/mcp-server/src/tools/glide-ship.ts` — suggestion: create `missing`
- `packages/mcp-server/src/tools/glide-status.ts` — suggestion: create `missing`
- `packages/mcp-server/src/tools/glide-test-tools.ts` — suggestion: create `missing`
- `packages/mcp-server/src/tools/glide-trace.ts` — suggestion: create `missing`
- `packages/mcp-server/src/tools/glide-tracer.ts` — suggestion: create `missing`
- `packages/permissions/src/gates.ts` — suggestion: create `missing`
- `packages/permissions/src/permissions.ts` — suggestion: create `missing`
- `packages/permissions/src/runtime.ts` — suggestion: create `missing`
- `packages/plugin-api/src/composition.ts` — suggestion: create `missing`
- `packages/plugin-api/src/durability.ts` — suggestion: create `missing`
- `packages/plugin-api/src/loader.ts` — suggestion: create `missing`
- `packages/plugin-api/src/registry.ts` — suggestion: create `missing`
- `packages/plugin-api/src/session.ts` — suggestion: create `missing`
- `packages/tracer/src/graphify.ts` — suggestion: create `missing`
- `packages/tracer/src/jsonl-writer.ts` — suggestion: create `missing`
- `packages/tracer/src/trace-runtime.ts` — suggestion: create `missing`
- `packages/tracer/src/tracer.ts` — suggestion: create `missing`

### P3 — Suggested targeted test cases by package
