# ADR: Context Isolation Strategy for Glide

## Status
Proposed — awaiting CTO review and research agent findings.

## Decision
Every agent and orchestrator gets its own bounded context. Contexts are organized by **Cluster ID**, not globally shared.

## Rationale
Mid-tier models have limited working memory. Sharing one big context across 20 teams and 100 agents will cause:
- Context pollution (irrelevant data crowds important signals)
- Higher cost per iteration
- Increased hallucination risk
- Difficulty attributing reasoning

## Proposed Model
1. **Cluster**: a logical work unit (e.g., "feature-auth", "bugfix-payment", "research-rag")
2. **Context ID**: deterministic hash of `(cluster_id, role, agent_id, step)`
3. **Scope rules**:
   - Orchestrator sees: cluster goal + team summaries + todo registry summaries
   - Team lead sees: cluster goal + own todos + subagent outputs
   - Worker sees: own GOAL.md + own TODO.md + immediate parent output
   - CTO sees: all cluster summaries + meeting minutes + decision log
4. **Promotion**: only finalized artifacts (plans, code, reports) get promoted to global store
5. **Ephemeral scratch**: intermediate reasoning stays in cluster-local scratch files

## Alternatives Considered
- Single shared context: rejected (pollution, cost, hallucination)
- Fully isolated per agent: rejected (duplication, no cross-team learning)
- Hybrid (shared core + private scratch): preferred, aligns with Hermes subagent model

## Dependencies
- Research agent: "context isolation strategies for mid-tier model multi-agent systems"
- Decision: exact Cluster ID scheme and promotion rules
