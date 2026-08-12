# Glide Meeting Minutes Template

## Status
Locked — append-only audit trail format.

## Template
```md
# Meeting Minutes — <objective-slug>

**Timestamp:** <ISO8601>
**Objective:** <raw user objective>
**Brief Hash:** <sha256 of brief>
**Drift Score:** <0.0-1.0>
**Status:** proposed | approved | rejected | amended

## Attendees
- CTO Assistant
- Architect
- Product Manager
- QA Lead
- Meta-Learning Researcher
- Context Engineer
- SRE
- Security Engineer
- Data Engineer
- MCP Tooling Engineer
- Platform PM

## Raw Objective
<verbatim user input>

## Structured Brief
- Goal:
- Constraints:
- Success Criteria:
- Out of Scope:

## Role Outputs

### Architect
...

### Product Manager
...

## Rejected Proposals
| Proposal | Reason | Improvement Path | Rejected By | Timestamp |
|----------|--------|------------------|-------------|-----------|

## Final Proposal
### Plan
...

### Architecture
...

### Todos
...

## Approval
- [ ] CTO Assistant
- [ ] Orchestrator
- [ ] Todo Registry
```

## Rules
- Minutes are append-only
- Every rejection must have reason, improvement path, timestamp, and rejecter identity
- Drift score > 0.3 requires realignment before finalization
