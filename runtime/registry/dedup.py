"""Todo dedup engine for Todo Registry Agent."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Optional

from runtime.logging import get_logger, log_event

__all__ = ["DedupResult", "TodoProposal", "cosine_similarity", "decide", "exact_hash", "jaccard"]

_LOGGER = get_logger("glideloop.dedup")


@dataclass
class TodoProposal:
    todo_id: str
    content: str
    agent_id: str
    session_id: str
    priority: int = 0


@dataclass
class DedupResult:
    decision: str  # create | merge | reject
    target_todo_id: Optional[str] = None
    similarity: Optional[float] = None
    reason: Optional[str] = None


def exact_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def jaccard(a: str, b: str) -> float:
    tokens_a = set(a.lower().split())
    tokens_b = set(b.lower().split())
    if not tokens_a and not tokens_b:
        return 1.0
    inter = tokens_a & tokens_b
    union = tokens_a | tokens_b
    return len(inter) / len(union)


def cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(y * y for y in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def decide(
    proposal: TodoProposal,
    *,
    existing_contents: list[str],
    existing_embeddings: dict[str, list[float]],
    threshold: float = 0.92,
) -> DedupResult:
    exact = exact_hash(proposal.content)
    for content in existing_contents:
        if exact_hash(content) == exact:
            return DedupResult(decision="merge", similarity=1.0, reason="exact match")
        if jaccard(proposal.content, content) >= 0.85:
            return DedupResult(decision="merge", similarity=jaccard(proposal.content, content), reason="jaccard match")
    if existing_embeddings:
        emb = existing_embeddings.get(exact)
        if emb is not None:
            best = max(
                (cosine_similarity(emb, other) for other in existing_embeddings.values()),
                default=0.0,
            )
            if best >= threshold:
                log_event(_LOGGER, "todo_dedup_semantic_match", {"proposal_todo_id": proposal.todo_id, "similarity": best, "reason": "semantic match"})
                return DedupResult(decision="merge", similarity=best, reason="semantic match")
    log_event(_LOGGER, "todo_dedup_novel", {"proposal_todo_id": proposal.todo_id, "reason": "novel todo"})
    return DedupResult(decision="create", similarity=None, reason="novel todo")
