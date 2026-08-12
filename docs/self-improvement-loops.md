# Glide — Two Self-Improvement Loops

## Status
Proposed — part of deep planning phase.

## Core Principle
Glide has **two separate self-improvement loops** with different purposes, cadences, and safety gates. Mixing them causes unsafe mutations.

---

## Loop A: System Self-Improvement (Glide improves itself)

### Purpose
Improve the system's own prompts, strategies, routing rules, personality files, and workflow logic.

### Cadence
- **Slow timescale**: weekly
- **Trigger**: every 7 days, or after 50 completed tasks, whichever comes first

### Scope
- Agent prompts and personality files
- Team definitions and activation rules
- Routing and dedup thresholds
- Orchestrator strategies
- Meeting room protocols
- Meta-layer decisions

### Safety Gates
1. **Held-out validation**: candidate must not regress on disjoint validation episodes
2. **Versioned artifacts**: never overwrite current stable in place
   - Write candidate → validate → promote or rollback
   - Always retain last known good version
3. **Textual gradient log**: structured failure feedback tied to specific artifact versions
4. **Experience replay buffer**: successful trajectories + reflections
5. **Registry/graph index**: maps which artifact versions were used for which tasks

### Architecture
```
Meta-Agent (Loop A)
├── Observes: all office trajectories, meeting minutes, task outcomes
├── Proposes: candidate prompt/strategy/workflow changes
├── Validates: on held-out episodes
├── Promotes: if monotone-nonregressing
└── Rolls back: if regression detected
```

### Persistence
- Artifact store: versioned NL artifacts per agent/tool/workflow node
- Metadata per version: timestamp, parent version, validation scores, rollout hash
- Audit trail: full textual-gradient + rollout history

---

## Loop B: Runtime Output Improvement (Improve user-facing outputs)

### Purpose
Improve the quality of plans, code, reports, and deliverables produced for the user.

### Cadence
- **Fast timescale**: daily
- **Trigger**: every 24 hours, or after 20 completed user tasks, whichever comes first

### Scope
- Prompt refinement per role
- Summarization quality
- Dedup threshold tuning
- Meeting room facilitation quality
- Plan/architecture output quality
- Code/report formatting

### Safety Gates
1. **Lighter validation**: A/B testing on held-out tasks
2. **User feedback correlation**: track which changes correlate with positive user feedback
3. **No system config mutation**: Loop B cannot modify system config without Loop A approval
4. **Bounded scope**: only prompt/output-level changes, not workflow logic

### Architecture
```
Runtime Improver (Loop B)
├── Observes: recent task outcomes, user feedback, quality metrics
├── Proposes: candidate prompt/output improvements
├── Validates: A/B on held-out tasks
├── Promotes: if quality improves
└── Escalates: if system-level change needed → Loop A
```

### Persistence
- Experience replay buffer: successful trajectories + reflections per task family
- Ranked hindsight: ranked sequence of past outputs + feedback
- Prompt candidate store: versioned prompt variants with validation scores

---

## Why Two Loops?

| Concern | Loop A | Loop B |
|---------|--------|--------|
| Purpose | Improve the system | Improve outputs |
| Cadence | Weekly | Daily |
| Validation | Strict held-out | A/B testing |
| Scope | Config/workflow | Prompts/outputs |
| Risk tolerance | Low | Medium |
| Can modify system config? | Yes | No (escalates to A) |

**Key insight**: Mixing system improvements with output improvements causes unsafe mutations. System changes need stronger validation (weekly gate). Output improvements can iterate faster (daily) with lighter validation.

---

## Implementation Notes
- Loop A runs as a separate process with its own state directory
- Loop B runs inside the Orchestrator with read-only access to Loop A artifacts
- Both loops write to the same event stream but with different event types
- All improvements are logged in `/glide/meta/` with full audit trail
