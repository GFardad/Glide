# Glide — Parallel Scalability Design

## Status
Proposed — part of deep planning phase.

## Core Principle
Everything must be scalable as parallel tests (different sessions, different contexts) without lowering quality, and must improve quality over time.

## Requirements
1. **Session isolation**: each objective gets its own session ID, state directory, and context namespace
2. **Context isolation**: each agent gets its own context scope (see ADR-001)
3. **Parallel by default**: teams and agents run concurrently unless explicitly sequenced
4. **Quality gates**: every parallel branch must pass the same acceptance criteria as serial execution
5. **Merge semantics**: parallel outputs are merged by the Orchestrator using conflict resolution rules

## Architecture

### Session Model
```
session_id = hash(objective + timestamp + user_id)
├── /glide/sessions/<session_id>/
│   ├── state.json          # session-level state
│   ├── meeting/
│   │   └── minutes.md      # meeting room output
│   ├── teams/
│   │   ├── team-eng/
│   │   ├── team-research/
│   │   └── ...
│   ├── agents/
│   │   ├── <agent_id>/
│   │   │   ├── PERSONALITY.md
│   │   │   ├── GOAL.md
│   │   │   ├── NOTES.md
│   │   │   ├── TODO.md
│   │   │   └── REJECTED.md
│   │   └── ...
│   └── artifacts/
│       ├── plan.md
│       ├── architecture.md
│       └── todos.json
```

### Parallel Execution Model
- Each session runs in its own process group
- Sessions do not share mutable state
- Read-only references (personalities, templates) can be shared via copy-on-write
- All writes go through the Todo Registry with optimistic concurrency
- The Orchestrator maintains a session registry with status, PID, and resource usage

### Quality Assurance
- **Acceptance criteria**: every session defines pass/fail criteria upfront in `state.json`
- **Parallel quality gates**: each team/agent branch runs its own QA check before submitting output
- **Merge validation**: Orchestrator validates merged output against session acceptance criteria
- **Regression testing**: new sessions reuse validation episodes from previous sessions

### Scalability Targets
- Up to 20 concurrent sessions
- Up to 10 teams per session
- Up to 5 agents per team
- Up to 5 subagents per agent
- Total: up to 5,000 concurrent agent instances across sessions

### Resource Management
- Per-session memory limits
- Per-agent CPU time limits
- Global concurrency limit (configurable, default 50 parallel agents)
- Priority queue for session scheduling

## Implementation Strategy
1. **Phase 1**: single session, single context, prove quality
2. **Phase 2**: multi-session, isolated contexts, parallel teams
3. **Phase 3**: dynamic scaling, resource-aware scheduling
4. **Phase 4**: quality regression testing across sessions
