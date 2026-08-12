# Glide Loop B — Runtime Output Improvement

## Status
Proposed — focused design for daily runtime self-improvement.

## Core Purpose
Loop B is a **daily runtime coach** for mid-tier models. It does not change system config. It detects when agents are stuck or producing low-quality output, delivers targeted hints/feedback, and remembers what worked.

---

## 1. What Loop B Improves

| Target | Improvement |
|--------|-------------|
| Stuck agents | Unblock via hints, context reframing, or task decomposition |
| Low-quality outputs | Refine via feedback, examples, or prompt patching |
| Repetitive failures | Pattern-match against known failure modes and inject corrections |
| Drifting plans | Realign via CTO Assistant reminders of original intent |
| Todo proliferation | Dedup + prune via Registry before agent wastes cycles |

---

## 2. Detection Signals

Loop B monitors every agent's `NOTES.md` and `TODO.md` plus orchestrator telemetry.

### 2.1 Stuck Detection
| Signal | Threshold | Action |
|--------|-----------|--------|
| No TODO progress for N minutes | N = 2× expected task duration | Flag as stuck |
| Same error message repeated ≥3 times in NOTES.md | Within one task | Flag as repetitive failure |
| TODO item age > 24h without state change | Any P0/P1 item | Escalate to parent |
| Output length anomaly | >3σ from role average | Review for rambling/hallucination |
| Empty or placeholder output | Detected via regex | Immediate re-prompt with hint |

### 2.2 Quality Detection
| Signal | Threshold | Action |
|--------|-----------|--------|
| Parent rejection count ≥ 2 in REJECTED.md | Per agent per day | Trigger quality review |
| Registry dedup match > 0.92 against own prior output | Same agent | Flag as repetitive/unoriginal |
| CTO Assistant drift score > 0.3 | Per meeting round | Inject realignment hint |
| Todo completion rate < 50% | Per team per day | Review task sizing |
| User feedback negative | Direct signal | Lock current output, escalate |

---

## 3. Hint/Intervention Strategies

### 3.1 Stuck Agent Hints
```
1. Context reframe: "You have been working on X for 10 minutes. 
   Here is the original GOAL.md acceptance criteria."

2. Task decomposition: Break current TODO into 2 smaller todos 
   with explicit first-next-step.

3. Example injection: Append 1-2 examples of similar completed 
   tasks from NOTES.md history.

4. Role reminder: Re-inject first 3 lines of PERSONALITY.md 
   (mandate + constraints).

5. Parent ping: Notify parent/CTO/Orchestrator that this agent 
   needs attention or re-assignment.
```

### 3.2 Low-Quality Output Hints
```
1. Rejection with path: Write to REJECTED.md with reason + 
   acceptance criteria + 1 example of acceptable output.

2. Prompt patch: Append "Previous attempt was rejected because 
   <reason>. Next attempt must: <criteria>."

3. Constraint tightening: Add explicit format/length/scope 
   constraints to GOAL.md temporarily.

4. Tool restriction: Remove non-essential tools from agent's 
   context to reduce hallucination surface.

5. Human-escalation: If 3 consecutive rejections, flag to CTO 
   for human decision.
```

### 3.3 Drift Correction
```
1. Minutes injection: Paste original user intent from meeting 
   minutes into agent context.

2. Diff summary: Show agent what changed from approved plan 
   and what must revert.

3. Scope lock: Freeze GOAL.md for 1 cycle; no new todos accepted.
```

---

## 4. Loop B Architecture

```
Runtime Improver (Loop B)
├── Monitor: reads NOTES.md, TODO.md, REJECTED.md, Registry events
├── Detect: applies signal thresholds above
├── Decide: selects intervention strategy
├── Inject: writes hint to agent's context or TODO.md
└── Learn: records intervention → outcome in experience replay
```

### 4.1 cadence
- **Fast**: every 15 minutes, scan all active agents for stuck/low-quality signals
- **Daily**: full review of all interventions, outcomes, and patterns
- **Weekly summary**: trends report to CTO Assistant

### 4.2 Safety
- Loop B cannot modify `PERSONALITY.md` or `GOAL.md` directly
- Loop B can only append to `NOTES.md` and `TODO.md`
- Loop B cannot delete or overwrite agent files
- All interventions logged with timestamp, signal, strategy, and outcome
- If intervention makes things worse (measured by next-cycle quality), roll back and flag

---

## 5. Memory and Learning

### 5.1 Experience Replay Buffer
```
/glide/meta/loop-b/
├── interventions/
│   └── <session_id>_<timestamp>.jsonl
├── hindsight/
│   └── <task_family>_<date>.md
└── patterns/
    └── <pattern_name>.md
```

Each intervention record:
```json
{
  "session_id": "...",
  "agent_id": "...",
  "timestamp": "...",
  "signal": "stuck | low_quality | drift | repetitive",
  "strategy": "context_reframe | decomposition | example_injection | ...",
  "outcome": "success | partial | failure | rollback",
  "quality_delta": 0.15,
  "notes": "..."
}
```

### 5.2 Pattern Extraction
- Daily: scan interventions for recurring patterns
- If same signal + same strategy + same outcome ≥ 3 times → promote to `patterns/`
- Pattern includes: trigger condition, recommended strategy, expected outcome, confidence

### 5.3 Hindsight per Task Family
- Group interventions by task family (e.g., "code-review", "plan-document", "research-brief")
- Rank strategies by success rate per family
- Inject top-ranked strategies as default hints for that family

---

## 6. Integration with Agent File Contract

Loop B writes to:
- `NOTES.md`: appends observation + intervention note
- `TODO.md`: may add decomposition hints or re-prioritize
- `REJECTED.md`: may add pattern-based rejection rationale

Loop B reads from:
- `PERSONALITY.md`: to tailor hints to role
- `GOAL.md`: to realign drifted agents
- `TODO.md`: to detect stuck/aging items
- `REJECTED.md`: to detect repetitive failure patterns

---

## 7. Safety Guardrails

1. **No direct output modification**: Loop B never rewrites agent output; it only injects hints
2. **No config mutation**: Loop B cannot change system or role configuration
3. **Bounded interventions**: max 1 hint per agent per 15-minute window
4. **Rollback on harm**: if quality degrades after intervention, revert and log
5. **CTO override**: CTO can disable Loop B for any session or agent
6. **Audit trail**: every intervention is immutable once written

---

## 8. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Stuck recovery rate | >70% | agents unstuck within 2 hints |
| Quality improvement rate | >60% | rejected outputs that pass after hint |
| Drift correction rate | >80% | drift score returns below 0.2 after intervention |
| False positive rate | <15% | interventions that don't help |
| User satisfaction correlation | Positive | daily feedback vs intervention density |

---

## 9. Dependencies
- Agent file contract (PERSONALITY.md, GOAL.md, NOTES.md, TODO.md, REJECTED.md)
- Todo Registry for dedup signals
- Meeting Minutes for drift detection
- CTO Assistant for escalation path
