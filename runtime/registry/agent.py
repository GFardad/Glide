"""Todo Registry Agent."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from .dedup import TodoProposal, decide, exact_hash, jaccard
from .schema import init_db

from runtime.logging import get_logger, log_event

__all__ = ["TodoRegistryAgent"]

_LOGGER = get_logger("glideloop.registry")


class TodoRegistryAgent:
    def __init__(self, db_path: Optional[str] = None) -> None:
        self.conn = init_db(db_path)

    def propose(self, *, agent_id: str, session_id: str, content: str, priority: int = 0) -> dict[str, Any]:
        proposal = TodoProposal(
            todo_id=str(uuid.uuid4()),
            content=content,
            agent_id=agent_id,
            session_id=session_id,
            priority=priority,
        )
        cur = self.conn.cursor()
        cur.execute("SELECT todo_id, content FROM todos WHERE session_id = ?", (session_id,))
        rows = cur.fetchall()
        existing = {row[0]: row[1] for row in rows}
        result = decide(
            proposal,
            existing_contents=list(existing.values()),
            existing_embeddings={},
        )
        now = datetime.now(timezone.utc).isoformat() + "Z"
        target_todo_id = result.target_todo_id
        if result.decision == "merge" and not target_todo_id:
            for todo_id, content in existing.items():
                if exact_hash(content) == exact_hash(proposal.content) or jaccard(content, proposal.content) >= 0.85:
                    target_todo_id = todo_id
                    break
        if result.decision == "create":
            cur.execute(
                "INSERT INTO todos (todo_id, session_id, agent_id, content, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)",
                (proposal.todo_id, session_id, agent_id, content, priority, now, now),
            )
            cur.execute(
                "INSERT INTO events (session_id, todo_id, event_type, detail) VALUES (?, ?, 'created', ?)",
                (session_id, proposal.todo_id, content),
            )
            log_event(_LOGGER, "todo_created", {"todo_id": proposal.todo_id, "session_id": session_id, "agent_id": agent_id, "similarity": result.similarity, "reason": result.reason})
        elif result.decision == "merge" and target_todo_id:
            cur.execute(
                "UPDATE todos SET updated_at = ? WHERE todo_id = ?",
                (now, target_todo_id),
            )
            cur.execute(
                "INSERT INTO events (session_id, todo_id, event_type, detail) VALUES (?, ?, 'merged', ?)",
                (session_id, target_todo_id, content),
            )
            log_event(_LOGGER, "todo_merged", {"session_id": session_id, "source_todo_id": proposal.todo_id, "target_todo_id": target_todo_id, "similarity": result.similarity, "reason": result.reason})
        else:
            log_event(_LOGGER, "todo_skipped", {"session_id": session_id, "todo_id": proposal.todo_id, "decision": result.decision, "similarity": result.similarity, "reason": result.reason})
        self.conn.commit()
        return {
            "todo_id": proposal.todo_id,
            "decision": result.decision,
            "similarity": result.similarity,
            "reason": result.reason,
            "target_todo_id": result.target_todo_id,
        }
