# Glide Meeting Room — Personality-Driven Architecture

## Status
Proposed — awaiting CTO review.

## Core Idea
The CTO does not design alone. Before any plan reaches the Orchestrator, it goes through a **meeting room** of personality-driven agents. Each role has a distinct perspective, constraints, and output schema. The CTO Assistant moderates, checks drift, and ensures the final plan matches the user's original intent.

## Roles
| Role | Source of Truth | Responsibility | Output |
|------|-----------------|----------------|--------|
| CTO (Hermes skill) | User intent | Final decision, idea approval, drift correction | Approved plan + minutes |
| CTO Assistant | CTO mandate | Refine ideas, check drift, coordinate meeting | Refined proposal + risk flags |
| Architect | System design | Structural decisions, boundaries, interfaces | Architecture doc + ADRs |
| Engineer | Implementation | Feasibility, effort estimation, risks | Technical plan + task breakdown |
| Researcher | Evidence | Mega-Research, validation, alternatives | Research brief + sources |
| QA | Quality | Acceptance criteria, test strategy, rollback | QA plan + pass criteria |
| Security | Safety | Threat model, permissions, isolation | Security review |
| Product | Value | User impact, scope, priorities | Scope doc + prioritization |
| Designer | UX/Interface | Agent UX, workflow ergonomics | Flow diagrams + UX notes |
| Data | Metrics | Observability, logging, improvement signals | Metrics schema + alert rules |

## Meeting Flow
1. **User submits idea** → CTO captures as raw Minutes
2. **CTO Assistant** reviews against recent history; if drift > threshold, flag to CTO
3. **Round-table**: each role produces a 1-page perspective in parallel
4. **Synthesis**: CTO Assistant merges perspectives, highlights conflicts
5. **CTO review**: CTO checks alignment with user intent; requests revisions if needed
6. **Consensus**: if all roles approve, plan is locked and sent to Orchestrator

## Personality Format
Each role is defined in `/glide/meeting-room/roles/<role>.md`:
```
# Role: <Name>

## Mandate
[What this role optimizes for]

## Constraints
[Hard boundaries this role cannot cross]

## Output Schema
[JSON/MD structure this role must produce]

## Perspective
[How this role views problems differently]
```

## Drift Detection
- Every 5 steps, CTO Assistant compares current proposal to original user Minutes
- Drift score = semantic similarity between current proposal and original intent
- If drift > threshold: CTO is alerted; meeting returns to alignment phase
- All additions/deletions are logged with rationale in Minutes

## Minutes Format
All decisions, revisions, and rationales are appended to `/glide/meeting-room/minutes/<timestamp>_<cluster_id>.md`:
```
# Meeting Minutes: <Cluster ID>
## Date: <ISO timestamp>
## User Intent: <original quote>
## Drift Score: <0-1>
## Decision: <approved / revised / rejected>
## Changes:
- Added: <what + why>
- Removed: <what + why>
- Modified: <what + why>
```

## Personality Source
The user mentioned "Superpowers" project. Research found no public repo under that exact name. I recommend we:
1. Ask the user for the exact repo/URL
2. In the meantime, design our own personality format inspired by Camel/ChatDev/MetaGPT patterns
3. Make personality files hot-swappable so we can import any format later

## Dependencies
- Mega-Research tool must be available to all meeting roles
- Context isolation per role (see ADR-001)
- Todo Registry for action items emerging from meetings
