"""Tests for runtime meta loop_b monitor/intervention/memory."""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

from runtime.meta.loop_b import LoopBIntervention, LoopBMemory, LoopBMonitor


def test_monitor_flags_repetitive_failure(tmp_path):
    root = tmp_path / "workspace"
    agent_dir = root / "agents" / "agent-1"
    agent_dir.mkdir(parents=True)
    (agent_dir / "NOTES.md").write_text("Error: boom\nError: boom\nError: boom\n", encoding="utf-8")
    (agent_dir / "TODO.md").write_text("- [ ] task\n", encoding="utf-8")
    result = LoopBMonitor(workspace=str(root)).scan("agent-1")
    assert result.status == "flagged"
    assert any(item["type"] == "repetitive_failure" for item in result.signals)


def test_intervention_returns_hint(tmp_path):
    root = tmp_path / "workspace"
    agent_dir = root / "agents" / "agent-1"
    agent_dir.mkdir(parents=True)
    (agent_dir / "NOTES.md").write_text("Error: boom\nError: boom\nError: boom\n", encoding="utf-8")
    (agent_dir / "TODO.md").write_text("- [ ] task\n", encoding="utf-8")
    monitor = LoopBMonitor(workspace=str(root))
    result = monitor.scan("agent-1")
    hint = LoopBIntervention(workspace=str(root)).maybe_hint("agent-1", scan=result)
    assert hint is not None
    assert hint.hint.strip()


def test_memory_records_and_extracts_patterns(tmp_path):
    memory = LoopBMemory(root=str(tmp_path / "memory"))
    path = memory.record(
        {
            "session_id": "s1",
            "agent_id": "agent-1",
            "timestamp": "2026-08-07T00:00:00+00:00",
            "signal": "repetitive_failure",
            "strategy": "example_injection",
            "outcome": "success",
            "quality_delta": 0.2,
            "notes": "note",
        }
    )
    assert path.exists()
    patterns = memory.extract_patterns()
    assert isinstance(patterns, list)


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
