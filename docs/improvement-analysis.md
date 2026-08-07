# Glideloop Improvement Analysis

## Current State
- 139 unit tests passing
- Structured JSONL logging via `runtime/logging.py`
- CEO runtime delegates to CTO Manager
- CTO Manager has team registration, broadcast, sync, merge proposal, dev/prod sessions
- MCP server exposes `ceo_execute`, `ceo_status`, `ceo_history`, `version_*`
- Loop A/B for self-improvement
- Observability counters
- Systemd timers for Loop A
- End-to-end CEO→CTO flow verified

## 5 Mega Improvements

1. **Persistent Multi-Session CEO State**
   - Current: `/tmp/glideloop-ceo-state.json` is transient
   - Need: SQLite-backed CEO session history with TTL cleanup
   - Impact: CEO survives Hermes restarts; cross-session context preserved

2. **Full Structured Event Pipeline**
   - Current: JSONL logs written, but no centralized ingestion
   - Need: Event router + typed schemas + Loki/OTEL compatibility
   - Impact: Real-time observability, audit trail, debugging at scale

3. **Automated Promotion Pipeline**
   - Current: Manual `promote_release.sh`
   - Need: CEO-driven `promote` command with quality gates + auto-merge
   - Impact: CTO can promote dev→main without manual script invocation

4. **Resilient Agent Execution**
   - Current: `retry_budget` exists but is simple
   - Need: Circuit breaker + exponential backoff + dead-letter queue
   - Impact: Fewer hangs, clearer failure modes, automatic recovery

5. **Branch-Aware Workspace Isolation**
   - Current: `GLIDELOOP_ROOT` shared
   - Need: Per-branch workspaces + automatic cleanup + merge artifact preservation
   - Impact: Dev/prod environments never collide; reproducible builds

## 20 Specific Improvements

### Logging & Observability
1. Add log correlation IDs to every CEO/CTO event
2. Emit `glideloop.ceo.duration` histograms for command latency
3. Add log rotation policy with max age/size in `runtime/logging.py`
4. Mask sensitive payload fields before logging
5. Add a `--json` flag to `runtime/manager/__main__.py` for machine-readable output
6. Export counters to `/metrics` endpoint for Prometheus scraping

### CEO/CTO Runtime
7. Add `ceo_execute` timeout parameter with automatic escalation on timeout
8. Implement `ceo_execute` retry with idempotency keys
9. Add CEO dry-run mode that logs without mutating state
10. Persist CEO history to SQLite with pagination
11. Add CTO Manager health-check endpoint
12. Implement team heartbeat with auto-removal of stale teams

### MCP Tooling
13. Add `ceo_promote` MCP tool that runs quality gates + git merge
14. Add `ceo_rollback` MCP tool for failed promotions
15. Expose Loop A/B status via `ceo_status` tool
16. Add MCP tool schema validation with `jsonschema`
17. Implement MCP tool rate limiting per session

### Quality & Testing
18. Add integration test for Loop A → CEO → CTO → dev_env flow
19. Add mutation testing for `runtime/quality/gates.py`
20. Implement test data factories for CEO/CTO fixtures

## Implementation Priority
1. Mega 1 + #10, #12 (state persistence)
2. Mega 2 + #1, #2, #3, #4 (logging pipeline)
3. Mega 3 + #13, #14, #15 (promotion automation)
4. Mega 4 + #7, #8, #9 (resilience)
5. Mega 5 + #11, #16, #17, #18, #19, #20 (isolation + quality)
