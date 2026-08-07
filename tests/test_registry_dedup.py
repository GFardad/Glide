"""Tests for runtime registry dedup engine."""

from __future__ import annotations

import pytest

from runtime.registry.dedup import DedupResult, TodoProposal, cosine_similarity, decide, exact_hash, jaccard


def test_exact_hash_deterministic():
    assert exact_hash("hello") == exact_hash("hello")
    assert exact_hash("hello") != exact_hash("world")


def test_jaccard_similarity():
    assert jaccard("hello world", "world hello") == 1.0
    assert jaccard("a b c", "x y z") == 0.0


def test_cosine_similarity():
    assert cosine_similarity([1, 0], [1, 0]) == 1.0
    assert cosine_similarity([1, 0], [0, 1]) == 0.0


def test_decide_exact_match_merges():
    proposal = TodoProposal(todo_id="t1", content="write tests", agent_id="a1", session_id="s1")
    result = decide(proposal, existing_contents=["write tests"], existing_embeddings={})
    assert result.decision == "merge"
    assert result.similarity == 1.0


def test_decide_jaccard_match_merges():
    proposal = TodoProposal(todo_id="t1", content="write tests now", agent_id="a1", session_id="s1")
    result = decide(proposal, existing_contents=["write tests now"], existing_embeddings={})
    assert result.decision == "merge"
    assert result.similarity == 1.0


def test_decide_semantic_match_merges():
    proposal = TodoProposal(todo_id="t1", content="deploy auth service", agent_id="a1", session_id="s1")
    exact = exact_hash("deploy auth service")
    existing = {exact: [1, 0], exact_hash("other"): [0, 1]}
    result = decide(proposal, existing_contents=[], existing_embeddings=existing)
    assert result.decision == "merge"


def test_decide_novel_creates():
    proposal = TodoProposal(todo_id="t1", content="unique task xyz", agent_id="a1", session_id="s1")
    result = decide(proposal, existing_contents=[], existing_embeddings={})
    assert result.decision == "create"


def test_dedup_result_fields():
    result = DedupResult(decision="create", similarity=None, reason="novel todo")
    assert result.decision == "create"
    assert result.similarity is None
    assert result.reason == "novel todo"


def test_decide_empty_proposal_creates():
    proposal = TodoProposal(todo_id="t1", content="", agent_id="a1", session_id="s1")
    result = decide(proposal, existing_contents=[], existing_embeddings={})
    assert result.decision == "create"
