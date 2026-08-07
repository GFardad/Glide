"""Tests for runtime registry agent and dedup."""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

from runtime.registry.agent import TodoRegistryAgent
from runtime.registry.dedup import TodoProposal, decide


def test_dedup_decides_create_for_novel():
    proposal = TodoProposal(todo_id="1", content="write auth", agent_id="a1", session_id="s1", priority=0)
    result = decide(proposal, existing_contents=["deploy infra"], existing_embeddings={})
    assert result.decision == "create"


def test_registry_creates_then_merges_duplicate(tmp_path):
    db = tmp_path / "registry.sqlite"
    registry = TodoRegistryAgent(db_path=str(db))
    first = registry.propose(agent_id="a1", session_id="s1", content="write auth")
    second = registry.propose(agent_id="a1", session_id="s1", content="write auth")
    assert first["decision"] == "create"
    assert second["decision"] == "merge"


def test_registry_persists_events(tmp_path):
    db = tmp_path / "registry.sqlite"
    registry = TodoRegistryAgent(db_path=str(db))
    registry.propose(agent_id="a1", session_id="s1", content="write auth")
    registry.propose(agent_id="a1", session_id="s1", content="write auth")
    rows = registry.conn.execute("SELECT event_type, detail FROM events WHERE session_id = 's1'").fetchall()
    event_types = [row[0] for row in rows]
    assert "created" in event_types
    assert "merged" in event_types
