# Glide Agent File Contract

## Status
Proposed — part of deep planning phase.

## Core Principle
Every agent (main + sub) gets a **directory of `.md` files** that serve as its persistent memory, goal state, and audit trail. Nothing is ever silently rejected.

## Required Files (Minimum Set)

### 1. `PERSONALITY.md`
- Role definition, mandate, constraints, perspective
- Hot-swappable; can be imported from external personality formats
- Read-only after initialization

### 2. `GOAL.md`
- Objective assigned by parent/CTO/Orchestrator
- Includes acceptance criteria and success metrics
- Updated only by parent; agent cannot modify

### 3. `NOTES.md`
- Agent's scratch space: observations, context, things tried, dead ends
- Append-only with timestamps
- Agent can write freely; parent can read

### 4. `TODO.md`
- Mutable checklist of active todos
- Format: `- [ ] <todo> (assigned: <who>, priority: <P0-P2>, accepted: <date>)`
- Only contains accepted todos

### 5. `REJECTED.md` (or `REJECTED/` directory)
- Every rejected todo/item gets an entry here
- **Nothing gets JUST rejected.** Each entry must have:
  - **Item**: what was rejected
  - **Reason**: why it was rejected
  - **What it must do** to not be rejected (acceptance criteria)
  - **Who rejected it** and when
  - **Current status**: rejected / needs-revision / accepted
- Parent/CTO/Orchestrator can revisit with new context

## Todo Lifecycle

```
PROPOSED → REGISTRY_CHECK → (DUPLICATE → MERGE/REJECT) → (NOVEL → PRIORITY) → ACCEPTED → TODO.md
                                                                                    ↓
                                                                              IN_PROGRESS → COMPLETED
                                                                                    ↓
                                                                              BLOCKED → UNBLOCKED
```

### States
- `PROPOSED`: agent created it in NOTES.md
- `REGISTRY_CHECK`: sent to Todo Registry Agent
- `DUPLICATE`: found in registry; merge or reject with reason
- `NOVEL`: not found in registry
- `ACCEPTED`: parent/CTO/Orchestrator approved; moved to TODO.md
- `IN_PROGRESS`: agent is actively working
- `COMPLETED`: done
- `BLOCKED`: waiting on dependency/input
- `REJECTED`: in REJECTED.md with full rationale

### Rejection Rules (Non-negotiable)
1. **No silent rejection**: every rejection writes to `REJECTED.md`
2. **Reason required**: why it was rejected
3. **Improvement path required**: what must change for acceptance
4. **Revisability**: parent can re-evaluate with new context
5. **Audit trail**: timestamp, who rejected, original proposer

## Directory Structure Example

```
/glide/agents/<agent_id>/
├── PERSONALITY.md
├── GOAL.md
├── NOTES.md
├── TODO.md
├── REJECTED.md
├── history/
│   └── <timestamp>_<event>.md
└── artifacts/
    └── <output files>
```

## File Formats

### GOAL.md
```markdown
# Goal: <title>
## Assigned By: <parent/CTO/Orchestrator>
## Assigned At: <ISO timestamp>
## Acceptance Criteria
- [ ] <criterion 1>
- [ ] <criterion 2>
## Success Metrics
- <metric 1>
- <metric 2>
## Context
<background info>
```

### TODO.md
```markdown
# Todo List
## Active
- [ ] <todo text> (priority: P0, assigned: <agent>, accepted: <date>)
- [ ] <todo text> (priority: P1, assigned: <agent>, accepted: <date>)

## Completed
- [x] <completed todo> (completed: <date>, outcome: <summary>)
```

### REJECTED.md
```markdown
# Rejected Items
## <timestamp> — Rejected by <who>
### Item
<what was rejected>
### Reason
<why it was rejected>
### What Must Change for Acceptance
<acceptance criteria>
### Status
rejected / needs-revision / accepted
```

### NOTES.md
```markdown
# Notes — <agent_id>
## <timestamp>
<observation, thing tried, context>
```

## Enforcement
- The Orchestrator validates agent file structure on assignment
- Missing files are auto-generated with placeholders
- Todo Registry Agent enforces the lifecycle; agents cannot skip steps
