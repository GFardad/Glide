# Glide Loop A — System Self-Improvement

## Status
Proposed — full design for weekly system self-improvement.

## Core Purpose
Loop A is a **weekly system architect** for Glide itself. It improves prompts, strategies, routing rules, personality files, and workflow logic. It has strict safety gates and never mutates live system config without validation.

---

## 1. What Loop A Improves

| Target | Improvement | Cadence |
|--------|-------------|---------|
| Agent prompts | Better role instructions, fewer failures | Weekly |
| Personality files | Refined mandates/constraints based on outcomes | Weekly |
| Team activation rules | Better team selection per objective | Weekly |
| Routing thresholds | Tune dedup/approval thresholds | Weekly |
| Orchestrator strategies | Better merge/conflict resolution | Weekly |
| Meeting protocols | Better drift detection, faster consensus | Weekly |
| Meta-layer decisions | Improve Loop B intervention strategies | Weekly |

---

## 2. Architecture

```
Meta-Agent (Loop A)
├── Observes: all office trajectories, meeting minutes, task outcomes
├── Proposes: candidate prompt/strategy/workflow changes
├── Validates: on held-out episodes
├── Promotes: if monotone-nonregressing
└── Rolls back: if regression detected
```

### 2.1 Components

**Observer:**
- Scans all session artifacts: meeting minutes, agent NOTES.md, TODO.md, REJECTED.md
- Extracts failure patterns, repetitive rejections, stuck signals
- Correlates prompt/strategy versions with outcome quality
- Produces a weekly "system health report"

**Proposer:**
- Generates candidate artifacts: new prompt variants, revised personality files, adjusted thresholds
- Each candidate includes: target component, change description, expected improvement, risk assessment
- Candidates are written to `candidates/` directory, never to live config

**Validator:**
- Replays last N validation episodes (held-out from training set)
- Compares candidate performance against current stable
- Requires monotone non-regression: candidate must not be worse on any held-out episode
- Produces validation report with scores per episode

**Promoter:**
- If candidate passes validation: promotes to `stable/` directory
- Updates version metadata
- Notifies CTO Assistant of promotion
- If candidate fails: archives to `rejected/` with failure reason

---

## 3. Cadence and Triggers

### 3.1 Scheduled Runs
- **Weekly**: every Sunday at 00:00 UTC
- **Trigger**: 7 days since last run, or 50 completed tasks, whichever comes first

### 3.2 Event-Triggered Runs
- After 10+ rejections of the same prompt variant
- After 3+ consecutive stuck-recovery failures with same strategy
- After user feedback indicates systematic quality issue

### 3.3 Manual Trigger
- CTO can trigger Loop A via `glide_meta_status` tool
- CTO can specify which component to focus on

---

## 4. Artifact Store

```
/glide/meta/loop-a/
├── stable/
│   ├── prompts/
│   │   ├── engineer-v1.md
│   │   ├── engineer-v2.md
│   │   └── current -> engineer-v2.md
│   ├── strategies/
│   │   ├── routing-v1.json
│   │   └── current -> routing-v1.json
│   └── personalities/
│       ├── engineer-v1.md
│       └── current -> engineer-v1.md
├── candidates/
│   ├── prompts/
│   │   └── engineer-v3-draft.md
│   ├── strategies/
│   │   └── routing-v2-draft.json
│   └── personalities/
│       └── engineer-v2-draft.md
├── rejected/
│   ├── prompts/
│   ├── strategies/
│   └── personalities/
├── validation/
│   ├── episodes.jsonl          # held-out validation episodes
│   ├── reports/
│   │   └── <timestamp>_<candidate>.md
│   └── scores.jsonl            # per-candidate per-episode scores
└── history/
    └── <timestamp>_run.md       # full run log
```

### 4.1 Versioning Rules
- Each artifact version is immutable once written
- `current` symlink points to latest stable version
- Candidates are drafts; they never replace stable directly
- Promotion is atomic: write new stable → update symlink → verify

### 4.2 Metadata Per Version

```json
{
  "artifact_id": "engineer-prompt",
  "version": "v3",
  "parent_version": "v2",
  "created_at": "2026-08-05T00:00:00Z",
  "created_by": "Loop A Meta-Agent",
  "change_summary": "Added constraint: never approve without Security review",
  "validation_score": 0.92,
  "episodes_tested": 15,
  "episodes_passed": 14,
  "episodes_failed": 1,
  "rollout_hash": "abc123",
  "status": "stable | candidate | rejected"
}
```

---

## 5. Validation Protocol

### 5.1 Held-Out Episodes
- Last 20% of completed sessions are held out for validation
- Episodes are never used for training/prompting
- Each episode includes: objective, agent trajectories, outcomes, quality scores

### 5.2 Validation Criteria
- **Monotone non-regression**: candidate must not be worse than current stable on any held-out episode
- **Minimum improvement**: candidate must improve average score by ≥ 2% on ≥ 60% of episodes
- **No catastrophic failures**: candidate must not fail catastrophically on any episode

### 5.3 Validation Report

```markdown
# Validation Report: <candidate_id>

## Candidate
<file path, version, change summary>

## Current Stable
<file path, version>

## Episodes Tested
| Episode ID | Objective | Current Score | Candidate Score | Delta |
|------------|-----------|---------------|-----------------|-------|
| ep-001 | Build auth | 0.85 | 0.88 | +0.03 |
| ep-002 | Fix bug | 0.72 | 0.70 | -0.02 |

## Result
PASS | FAIL

## Recommendation
Promote | Reject | Revise

## Notes
<Any caveats, edge cases, or follow-up actions>
```

---

## 6. Safety Mechanisms

### 6.1 Atomic Promotion
```python
def promote_candidate(candidate_path: str, artifact_id: str):
    # 1. Write new stable version (new filename)
    stable_path = f"stable/{artifact_id}-v{new_version}.md"
    shutil.copy(candidate_path, stable_path)
    
    # 2. Update metadata
    write_metadata(stable_path, candidate_metadata)
    
    # 3. Atomic symlink swap
    temp_link = f"stable/current-{artifact_id}.tmp"
    os.symlink(stable_path, temp_link)
    os.replace(f"stable/{artifact_id}-current", temp_link)
    
    # 4. Verify
    assert os.path.exists(f"stable/{artifact_id}-current")
    assert os.readlink(f"stable/{artifact_id}-current") == stable_path
    
    # 5. Log promotion
    log_event("PROMOTED", artifact_id, new_version)
```

### 6.2 Rollback
- If promoted artifact causes degradation: roll back to previous version
- Rollback is instant (symlink swap back)
- Rollback is logged and reported to CTO
- Max 1 rollback per week; if exceeded, freeze Loop A for manual review

### 6.3 Quarantine
- New candidates run in quarantine for 1 validation cycle before promotion
- Quarantine artifacts are in `candidates/` directory, not referenced by live system
- Only after passing validation do they become eligible for promotion

---

## 7. Experience Replay and Hindsight

### 7.1 Experience Replay Buffer
```
/glide/meta/loop-a/experience/
├── trajectories/
│   └── <session_id>_<timestamp>.jsonl
└── reflections/
    └── <artifact_id>_reflection.md
```

Each trajectory record:
```json
{
  "session_id": "abc123",
  "artifact_versions": {
    "engineer-prompt": "v2",
    "routing-strategy": "v1"
  },
  "agent_trajectories": [
    {
      "agent_id": "eng-042",
      "role": "Engineer",
      "task": "Implement JWT endpoint",
      "outcome": "success | partial | failure",
      "quality_score": 0.85,
      "rejections": 0,
      "stuck_events": 0
    }
  ],
  "meeting_rounds": 3,
  "consensus_reached": true,
  "drift_score": 0.12,
  "user_feedback": "positive | neutral | negative",
  "timestamp": "2026-08-05T00:00:00Z"
}
```

### 7.2 Hindsight Format
```markdown
# Reflection: <artifact_id> v<version>

## Date
<ISO timestamp>

## Episodes
<number of episodes using this version>

## Outcomes
- Success rate: <X%>
- Average quality: <0.0-1.0>
- Rejection rate: <X%>
- Stuck rate: <X%>

## Insights
- <What worked>
- <What didn't work>
- <Unexpected patterns>

## Recommendations
- <Keep / Modify / Replace>
- <Specific changes>
```

---

## 8. Integration with Loop B

| Aspect | Loop A | Loop B |
|--------|--------|--------|
| Scope | System config, prompts, strategies | Runtime hints, agent coaching |
| Cadence | Weekly | Daily |
| Validation | Strict held-out | A/B testing |
| Can modify system config? | Yes (via promotion) | No |
| Observes | All trajectories | Active agents only |
| Feedback source | Outcome quality, regression | Stuck signals, rejections, drift |

**Key rule**: Loop B can propose prompt changes, but only Loop A can validate and promote them. Loop B's "prompt patches" are temporary hints in `NOTES.md`; Loop A's are versioned artifacts in `stable/`.

---

## 9. Safety Guardrails

1. **No in-place mutation**: Loop A never overwrites live config; writes candidates, validates, promotes atomically
2. **Held-out validation**: never train on episodes used for validation
3. **Monotone non-regression**: candidate must not regress on any held-out episode
4. **Rollback capability**: instant rollback via symlink swap
5. **CTO override**: CTO can freeze Loop A, reject any candidate, or force-rollback
6. **Quarantine period**: 1 validation cycle before promotion eligibility
7. **Audit trail**: every proposal, validation, promotion, and rollback is logged immutably

---

## 10. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| System quality trend | Monotonic non-decreasing | Weekly average quality score |
| Prompt stability | <2 changes per week | Count of promotions |
| Rollback rate | <10% | Failed promotions / total promotions |
| Validation coverage | 100% of candidates | Candidates with validation reports |
| Stuck recovery improvement | >5% weekly | Loop B stuck rate before/after prompt changes |

---

*This design is locked. Loop A is separate from Loop B and has stricter safety gates.*
