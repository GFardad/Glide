"""Tests for Loop B intervention strategies."""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

from runtime.meta.loop_b.intervention import LoopBIntervention, loop_b_hint
from runtime.meta.loop_b.monitor import AgentScan, LoopBMonitor


def _flagged_scan(tmp_path, agent_id="agent-1"):
    root = tmp_path / "workspace"
    agent_dir = root / "agents" / agent_id
    agent_dir.mkdir(parents=True)
    (agent_dir / "NOTES.md").write_text("Error: boom\nError: boom\nError: boom\n", encoding="utf-8")
    (agent_dir / "TODO.md").write_text("- [ ] task\n", encoding="utf-8")
    monitor = LoopBMonitor(workspace=str(root))
    return monitor.scan(agent_id)


def test_maybe_hint_returns_none_for_ok():
    intervention = LoopBIntervention(workspace="/tmp")
    result = intervention.maybe_hint("agent-1", scan=AgentScan(agent_id="agent-1", status="ok", signals=[], details={}))
    assert result is None


def test_maybe_hint_writes_example_injection(tmp_path):
    scan = _flagged_scan(tmp_path)
    intervention = LoopBIntervention(workspace=str(tmp_path / "workspace"))
    result = intervention.maybe_hint("agent-1", scan=scan)
    assert result is not None
    assert result.strategy == "example_injection"
    notes = (tmp_path / "workspace" / "agents" / "agent-1" / "NOTES.md").read_text(encoding="utf-8")
    assert "Loop B hint" in notes


def test_loop_b_hint_helper(tmp_path):
    scan = _flagged_scan(tmp_path, agent_id="agent-2")
    result = loop_b_hint(workspace=str(tmp_path / "workspace"), agent_id="agent-2", scan=scan)
    assert result is not None
    assert result.strategy == "example_injection"


def test_cooldown_blocks_duplicate_hints(tmp_path):
    scan = _flagged_scan(tmp_path)
    intervention = LoopBIntervention(workspace=str(tmp_path / "workspace"))
    first = intervention.maybe_hint("agent-1", scan=scan)
    second = intervention.maybe_hint("agent-1", scan=scan)
    assert first is not None
    assert second is None
