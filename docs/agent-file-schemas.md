# Glide Agent File Schemas

## Status
Locked — exact formats for all required agent files.

## Core Principle
Every agent (main + sub) gets a directory of `.md` files. These are the **only** persistent memory artifacts. No hidden state.

---

## 1. PERSONALITY.md

**Read-only after initialization. Hot-swappable for future personality imports.**

```markdown
# Role: <Role Name>

## Mandate
<What this role optimizes for. One paragraph.>

## Constraints
<Hard boundaries this role cannot cross. Bullet list.>

## Output Schema
<Required sections for every output. E.g.:>
- **Summary**: <what>
- **Recommendation**: <what>
- **Risks**: <what>
- **Next Steps**: <what>

## Perspective
<How this role views problems differently. One paragraph.>

## Tool Access
<Which tools this role may use. Bullet list or "ALL".>

## Escalation Rules
<When to escalate to parent. Bullet list.>
```

**Example (Engineer):**
```markdown
# Role: Engineer

## Mandate
You design and evaluate implementation plans for software systems. You optimize for feasibility, correctness, and maintainability.

## Constraints
- Do not approve security-sensitive designs without Security review
- Do not set deadlines without Infra confirmation
- Do not approve architectural changes without Architect sign-off

## Output Schema
- **Summary**: <2-3 sentences>
- **Feasibility**: <HIGH|MEDIUM|LOW + reason>
- **Task Breakdown**: <numbered list>
- **Risks**: <bullet list>
- **Open Questions**: <bullet list>

## Perspective
You view every idea through the lens of "can we build this, and will it break?"

## Tool Access
ALL

## Escalation Rules
- Escalate if feasibility is LOW
- Escalate if security implications are unclear
- Escalate if estimate > 5 days without Infra input
```

---

## 2. GOAL.md

**Updated only by parent/CTO/Orchestrator. Agent cannot modify.**

```markdown
# Goal: <Title>

## Assigned By
<parent agent ID / CTO / Orchestrator>

## Assigned At
<ISO 8601 timestamp>

## Priority
<P0 | P1 | P2>

## Acceptance Criteria
- [ ] <criterion 1 — testable, binary>
- [ ] <criterion 2 — testable, binary>

## Success Metrics
- <metric 1 — how measured>
- <metric 2 — how measured>

## Context
<Background info, links to related artifacts, constraints>

## Dependencies
- <blocking agent/task/artifact>

## Review Checkpoint
<When parent will review. E.g.: "After first TODO completion" or "Every 5 steps">
```

**Enforcement:**
- Orchestrator validates this file exists and is valid before assignment
- Missing files are auto-generated with placeholder values
- Agent must reference `GOAL.md` in every status report

---

## 3. NOTES.md

**Agent scratch space. Append-only with timestamps. Agent writes freely; parent reads.**

```markdown
# Notes — <agent_id>

## <ISO 8601 timestamp>
<observation, thing tried, dead end, context, partial result>

## <ISO 8601 timestamp>
<observation, thing tried, dead end, context, partial result>
```

**Rules:**
- Agent appends only; never deletes or edits prior entries
- Parent/CTO may read but should not edit
- Loop B may append intervention notes (marked with `[Loop B]` prefix)
- Max 1000 lines; oldest entries archived to `history/` when exceeded

**Example:**
```markdown
# Notes — eng-042

## 2026-08-05T00:15:00Z
Starting implementation of auth module. GOAL.md acceptance criteria clear.

## 2026-08-05T00:22:00Z
Tried approach A with JWT. Found that refresh token rotation is missing from spec. 
Flagged to parent. Waiting for Architect decision.

## 2026-08-05T00:45:00Z
[Loop B] Stuck signal: no TODO progress for 12 minutes. Injected hint: 
"Review Architect's ADR-003 before proceeding."
```

---

## 4. TODO.md

**Mutable checklist. Only contains accepted todos.**

```markdown
# Todo List — <agent_id>

## Active
- [ ] <todo text> (priority: P0, assigned: <agent_id>, accepted: <YYYY-MM-DD>, source: <parent/CTO/Registry>)
- [ ] <todo text> (priority: P1, assigned: <agent_id>, accepted: <YYYY-MM-DD>, source: <parent/CTO/Registry>)

## Completed
- [x] <completed todo> (completed: <YYYY-MM-DD>, outcome: <1-sentence summary>)
```

**Rules:**
- Only accepted todos appear here (post-Registry + parent approval)
- Agent marks items complete; parent may re-open with reason
- No silent deletion: completed items move to `## Completed` section
- Max 20 active items; overflow triggers parent review

**Example:**
```markdown
# Todo List — eng-042

## Active
- [ ] Implement JWT auth endpoint (priority: P0, assigned: eng-042, accepted: 2026-08-05, source: Architect)
- [ ] Add refresh token rotation (priority: P1, assigned: eng-042, accepted: 2026-08-05, source: Architect)
- [ ] Write unit tests for auth module (priority: P1, assigned: eng-042, accepted: 2026-08-05, source: QA)

## Completed
- [x] Review ADR-003 auth spec (completed: 2026-08-05, outcome: approved with 1 clarification)
```

---

## 5. REJECTED.md

**Every rejection is saved here. Nothing gets JUST rejected.**

```markdown
# Rejected Items — <agent_id>

## <YYYY-MM-DDTHH:MM:SSZ> — Rejected by <who>
### Item
<What was proposed/rejected>

### Reason
<Why it was rejected. Specific, actionable.>

### What Must Change for Acceptance
<Exact criteria that would make this acceptable.>

### Status
<rejected | needs-revision | accepted>

### Resolution
<If accepted later: what changed and when.>
```

**Rules:**
- Every rejection from parent/CTO/Registry writes here
- Agent can re-propose with modifications; new entry with updated timestamp
- Parent/CTO/Orchestrator can revisit any item with new context
- Max 50 entries; archive old to `history/rejected-<YYYY-MM>.md`

**Example:**
```markdown
# Rejected Items — eng-042

## 2026-08-05T00:30:00Z — Rejected by Architect
### Item
Use session cookies instead of JWT for auth

### Reason
JWT was explicitly chosen in ADR-003 for stateless mobile support. 
Session cookies require server-side storage and break the stateless constraint.

### What Must Change for Acceptance
1. Update ADR-003 to change auth mechanism from JWT to session cookies
2. Provide migration plan for existing mobile clients
3. Get CTO approval for architectural change

### Status
needs-revision

### Resolution
2026-08-05T01:00:00Z — Architect approved revision after CTO confirmed 
mobile support can use refresh tokens instead.
```

---

## 6. Directory Structure

```
/glide/sessions/<session_id>/agents/<agent_id>/
├── PERSONALITY.md
├── GOAL.md
├── NOTES.md
├── TODO.md
├── REJECTED.md
├── history/
│   ├── notes-<YYYY-MM>.md      # archived NOTES.md
│   ├── rejected-<YYYY-MM>.md   # archived REJECTED.md
│   └── <timestamp>_<event>.md  # milestone artifacts
└── artifacts/
    └── <output files, reports, code>
```

---

## 7. Validation Rules

| Rule | Enforcement |
|------|-------------|
| PERSONALITY.md exists before agent starts | Orchestrator pre-flight check |
| GOAL.md has valid acceptance criteria | Orchestrator assignment gate |
| TODO.md only has accepted items | Todo Registry enforcement |
| REJECTED.md has reason + improvement path | Parent/CTO write gate |
| NOTES.md is append-only | Agent runtime enforcement |
| No silent deletions | File system audit + hash chain |

---

## 8. File Size Limits

| File | Max Size | Action on Exceed |
|------|----------|------------------|
| PERSONALITY.md | 4 KB | Reject — role definition too broad |
| GOAL.md | 8 KB | Split into multiple goals |
| NOTES.md | 1000 lines | Archive to `history/` |
| TODO.md | 20 active items | Parent review required |
| REJECTED.md | 50 entries | Archive to `history/` |

---

*These schemas are locked. All future agent implementations must conform.*
