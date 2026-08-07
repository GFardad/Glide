"""Tests for Loop B monitor edge cases."""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

from runtime.meta.loop_b import LoopBIntervention, LoopBMemory, LoopBMonitor


def test_monitor_ok_when_no_signals(tmp_path):
    root = tmp_path / "workspace"
    agent_dir = root / "agents" / "agent-ok"
    agent_dir.mkdir(parents=True)
    (agent_dir / "NOTES.md").write_text("all good", encoding="utf-8")
    (agent_dir / "TODO.md").write_text("- [x] done\n", encoding="utf-8")
    (agent_dir / "REJECTED.md").write_text("", encoding="utf-8")
    (agent_dir / "PERSONALITY.md").write_text("role: engineer", encoding="utf-8")
    result = LoopBMonitor(workspace=str(root)).scan("agent-ok")
    assert result.status == "ok"
    assert result.signals == []


def test_intervention_cooldown_blocks_duplicate_hints(tmp_path):
    root = tmp_path / "workspace"
    agent_dir = root / "agents" / "agent-bad"
    agent_dir.mkdir(parents=True)
    (agent_dir / "NOTES.md").write_text("Error: boom\n" * 3, encoding="utf-8")
    (agent_dir / "TODO.md").write_text("- [ ] task\n", encoding="utf-8")
    monitor = LoopBMonitor(workspace=str(root))
    result = monitor.scan("agent-bad")
    intervention = LoopBIntervention(workspace=str(root))
    first = intervention.maybe_hint("agent-bad", scan=result)
    second = intervention.maybe_hint("agent-bad", scan=result)
    assert first is not None
    assert second is None


def test_memory_extract_patterns_empty(tmp_path):
    memory = LoopBMemory(root=str(tmp_path / "memory"))
    assert memory.extract_patterns() == []
