# Glide Todo Registry Schema

## Status
Proposed — SQLite schema + embedding strategy for the Todo Registry Agent.

## Core Principle
Every todo creation goes through the Registry Agent first. The Registry is the single source of truth for all todos across all sessions, teams, and agents. It uses RAG-backed semantic dedup to prevent duplicate work.

---

## 1. Database Schema

### 1.1 Core Tables

```sql
-- Todos: every todo ever created
CREATE TABLE todos (
    id TEXT PRIMARY KEY,              -- todo-<hash>
    session_id TEXT NOT NULL,         -- which session
    agent_id TEXT,                    -- proposing agent (NULL if from Registry itself)
    parent_todo_id TEXT,              -- if this is a subtask
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING|ASSIGNED|IN_PROGRESS|COMPLETED|BLOCKED|REJECTED|MERGED
    priority TEXT NOT NULL DEFAULT 'P1',     -- P0|P1|P2
    assignee TEXT,                    -- agent_id or team_id
    created_at TEXT NOT NULL,         -- ISO 8601
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    rejection_reason TEXT,            -- if REJECTED
    rejection_criteria TEXT,          -- what must change for acceptance
    rejected_by TEXT,
    merged_into TEXT,                 -- if MERGED, the surviving todo id
    version INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (parent_todo_id) REFERENCES todos(id)
);

-- Events: append-only log of all state changes
CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    todo_id TEXT,
    event_type TEXT NOT NULL,         -- CREATED|ASSIGNED|STARTED|COMPLETED|BLOCKED|REJECTED|MERGED|REOPENED
    actor TEXT NOT NULL,              -- who triggered this event
    payload TEXT,                     -- JSON with details
    timestamp TEXT NOT NULL,
    FOREIGN KEY (todo_id) REFERENCES todos(id)
);

-- Agents: every agent that ever existed
CREATE TABLE agents (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    team_id TEXT,
    role TEXT NOT NULL,
    parent_id TEXT,                   -- if subagent
    personality_path TEXT,
    goal_path TEXT,
    notes_path TEXT,
    todo_path TEXT,
    rejected_path TEXT,
    status TEXT NOT NULL DEFAULT 'active',  -- active|completed|failed|killed
    created_at TEXT NOT NULL,
    last_active TEXT,
    process_id INTEGER,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Sessions: every Glide session
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    objective TEXT NOT NULL,
    context TEXT,
    status TEXT NOT NULL DEFAULT 'running',  -- running|paused|completed|failed|stopped
    priority TEXT NOT NULL DEFAULT 'P1',
    approval_policy TEXT NOT NULL DEFAULT 'hybrid',
    max_teams INTEGER DEFAULT 5,
    max_parallel_agents INTEGER DEFAULT 20,
    created_at TEXT NOT NULL,
    completed_at TEXT,
    cto_approved_at TEXT,
    metadata TEXT                      -- JSON
);
```

### 1.2 Indexes

```sql
-- Fast lookups by session
CREATE INDEX idx_todos_session ON todos(session_id);
CREATE INDEX idx_events_session ON events(session_id);
CREATE INDEX idx_agents_session ON agents(session_id);

-- Fast lookups by agent
CREATE INDEX idx_todos_assignee ON todos(assignee);
CREATE INDEX idx_todos_agent ON todos(agent_id);

-- Fast status queries
CREATE INDEX idx_todos_status ON todos(status);
CREATE INDEX idx_todos_priority ON todos(priority, status);

-- Event ordering
CREATE INDEX idx_events_timestamp ON events(timestamp);
CREATE INDEX idx_events_todo ON events(todo_id, timestamp);
```

---

## 2. Embedding Strategy

### 2.1 What Gets Embedded

| Entity | Fields Embedded | Model | Dimensions |
|--------|----------------|-------|------------|
| Todo | title + description + parent context | `text-embedding-3-small` or `all-MiniLM-L6-v2` | 1536 or 384 |
| Agent output | NOTES.md last 500 chars + TODO.md current item | Same | Same |
| Meeting round | round summary + role outputs | Same | Same |

### 2.2 Embedding Storage

```sql
-- Option A: SQLite with vector extension (preferred for simplicity)
CREATE TABLE IF NOT EXISTS embeddings (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,        -- todo|agent_output|meeting_round
    entity_id TEXT NOT NULL,
    embedding BLOB,                   -- float32 array, 1536 or 384 dims
    model TEXT NOT NULL,              -- which model produced this
    created_at TEXT NOT NULL,
    FOREIGN KEY (entity_id) REFERENCES todos(id)
);

-- Option B: Separate Chroma/Weaviate collection
-- Collection: glide_todos
-- Metadata: session_id, agent_id, status, priority, created_at
```

### 2.3 Embedding Pipeline

```python
class EmbeddingPipeline:
    def embed_todo(self, todo: Todo) -> np.ndarray:
        text = f"{todo.title}. {todo.description}"
        # Prepend parent context for weak signal
        if todo.parent_todo_id:
            parent = self.get_todo(todo.parent_todo_id)
            text = f"Parent: {parent.title}. Subtask: {text}"
        return self.model.encode(text)

    def embed_agent_output(self, notes: str, current_todo: str) -> np.ndarray:
        text = f"Current task: {current_todo}. Recent notes: {notes[-500:]}"
        return self.model.encode(text)
```

---

## 3. Dedup Pipeline

### 3.1 Stages

```
New Todo Proposal
    │
    ▼
[1] Exact Hash Match
    │   hash(title + description + session_id)
    │   → If match: PROMPT_MERGE or REJECT
    │
    ▼
[2] Jaccard Pre-filter
    │   token_set_similarity(title + description)
    │   → If < 0.3: SKIP (no match)
    │   → If >= 0.3: continue
    │
    ▼
[3] Embedding Cosine Similarity
    │   cosine(embed(new), embed(candidates))
    │   → If < 0.85: NO_MATCH
    │   → If 0.85-0.92: BORDERLINE → cross-encoder
    │   → If > 0.92: MATCH → propose merge
    │
    ▼
[4] Cross-Encoder Re-rank (borderline only)
    │   cross_encoder.predict([new, candidate])
    │   → If > 0.7: MATCH
    │   → Else: NO_MATCH
    │
    ▼
[5] Merge or Create
```

### 3.2 Thresholds

| Signal | Threshold | Action |
|--------|-----------|--------|
| Exact hash match | 1.0 | Prompt merge with exact duplicate |
| Jaccard pre-filter | < 0.3 | Skip — no match |
| Embedding cosine | > 0.92 | Strong match — propose merge |
| Embedding cosine | 0.85-0.92 | Borderline — cross-encoder |
| Cross-encoder | > 0.7 | Match — propose merge |
| Cross-encoder | <= 0.7 | No match — create new |

### 3.3 Merge Logic

When a duplicate is detected:
1. Registry proposes merge to both agents
2. If accepted: mark newer todo as `MERGED`, point to survivor via `merged_into`
3. If rejected: mark as `REJECTED` with reason + improvement path
4. Both outcomes logged in `events` table

---

## 4. Todo Lifecycle State Machine

```
                    ┌─────────┐
                    │ PENDING  │ (created, awaiting priority)
                    └────┬────┘
                         │ Registry + parent approval
                         ▼
                    ┌─────────┐
                    │ASSIGNED │ (owned by agent)
                    └────┬────┘
                         │ agent starts work
                         ▼
              ┌──────────────────────┐
              │   IN_PROGRESS        │
              └──┬──────────────┬────┘
                 │              │
            completed          blocked
                 │              │
                 ▼              ▼
          ┌─────────┐    ┌─────────┐
          │COMPLETED│    │ BLOCKED │
          └─────────┘    └────┬────┘
                               │ unblocked
                               ▼
                        ┌─────────┐
                        │IN_PROGRESS│
                        └─────────┘

                    ┌──────────┐
                    │ REJECTED │ (with reason + criteria)
                    └────┬─────┘
                         │ revised and re-proposed
                         ▼
                    ┌─────────┐
                    │ PENDING  │
                    └─────────┘

                    ┌──────────┐
                    │  MERGED  │ (duplicate, merged into survivor)
                    └──────────┘
```

### State Transition Rules

| From | To | Allowed By | Condition |
|------|----|------------|-----------|
| PENDING | ASSIGNED | Registry + parent | Priority set, owner assigned |
| ASSIGNED | IN_PROGRESS | Agent | Agent marks started |
| IN_PROGRESS | COMPLETED | Agent | Acceptance criteria met |
| IN_PROGRESS | BLOCKED | Agent/Orchestrator | Dependency or input missing |
| BLOCKED | IN_PROGRESS | Orchestrator | Dependency resolved |
| PENDING | REJECTED | Registry/parent | Duplicate or out of scope |
| REJECTED | PENDING | Agent | Revised and re-proposed |
| PENDING | MERGED | Registry | Duplicate of existing todo |
| COMPLETED | IN_PROGRESS | Parent | Re-opened with reason |

---

## 5. Registry Agent Logic

### 5.1 On Todo Creation

```python
def on_todo_proposed(proposal: TodoProposal) -> TodoResult:
    # 1. Exact hash check
    if exact_hash_match(proposal):
        return propose_merge(proposal, existing)

    # 2. Jaccard pre-filter
    candidates = jaccard_search(proposal, threshold=0.3)
    if not candidates:
        return create_new(proposal)

    # 3. Embedding similarity
    strong_matches = []
    borderline = []
    for candidate in candidates:
        score = cosine_similarity(embed(proposal), embed(candidate))
        if score > 0.92:
            strong_matches.append(candidate)
        elif score >= 0.85:
            borderline.append(candidate)

    # 4. Cross-encoder on borderline
    for candidate in borderline:
        score = cross_encoder.predict(proposal, candidate)
        if score > 0.7:
            strong_matches.append(candidate)

    # 5. Decide
    if strong_matches:
        return propose_merge(proposal, strong_matches[0])
    else:
        return create_new(proposal)
```

### 5.2 Merge Proposal Format

```markdown
# Merge Proposal

## Proposed Todo
<new todo title and description>

## Existing Todo (Candidate)
<existing todo title and description>

## Similarity Score
<0.0-1.0>

## Recommendation
<merge | keep-both | reject-new>

## Rationale
<why>

## If Merged
- Survivor: <existing todo id>
- Deprecated: <new todo id>
- Combined description: <merged text>
```

---

## 6. Optimistic Concurrency

```sql
-- Version check on update
UPDATE todos 
SET status = 'COMPLETED', version = version + 1, completed_at = ?
WHERE id = ? AND version = ?;

-- If rows affected = 0, someone else updated it; retry or conflict
```

**Conflict resolution:**
- Last-write-wins with timestamp
- If concurrent modifications detected, flag for Orchestrator review
- Registry never silently drops updates

---

## 7. Retention and Archival

| Data | Retention | Archive Policy |
|------|-----------|----------------|
| Active todos | Forever | None |
| Completed todos | 90 days | Archive to `archive/todos-<YYYY-MM>.sqlite` |
| Events | 180 days | Archive to `archive/events-<YYYY-MM>.sqlite` |
| Embeddings | Match source todo | Delete when todo archived |
| Agents | 30 days after session ends | Archive to `archive/agents-<YYYY-MM>.sqlite` |

---

## 8. Monitoring Queries

```sql
-- Daily todo creation rate
SELECT DATE(created_at) as day, COUNT(*) as count
FROM todos WHERE created_at >= DATE('now', '-7 days')
GROUP BY day;

-- Duplicate detection rate
SELECT DATE(timestamp) as day, COUNT(*) as merge_proposals
FROM events WHERE event_type = 'MERGED'
GROUP BY day;

-- Rejection reasons
SELECT rejection_reason, COUNT(*) as count
FROM todos WHERE status = 'REJECTED'
GROUP BY rejection_reason ORDER BY count DESC;

-- Agent productivity
SELECT assignee, 
       COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed,
       COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) as in_progress,
       COUNT(CASE WHEN status = 'BLOCKED' THEN 1 END) as blocked
FROM todos GROUP BY assignee;
```

---

*This schema is locked. All future Registry implementations must conform.*
