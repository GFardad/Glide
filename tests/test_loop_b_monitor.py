"""Tests for Loop B monitor."""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

from runtime.meta.loop_b.monitor import AgentScan, LoopBMonitor


def test_scan_unknown_when_missing(tmp_path):
    monitor = LoopBMonitor(workspace=str(tmp_path))
    result = monitor.scan("missing-agent")
    assert result.status == "unknown"
    assert result.signals == []


def test_scan_flags_repetitive_failure(tmp_path):
    root = tmp_path / "workspace"
    agent_dir = root / "agents" / "agent-1"
    agent_dir.mkdir(parents=True)
    (agent_dir / "NOTES.md").write_text("Error: boom\nError: boom\nError: boom\n", encoding="utf-8")
    (agent_dir / "TODO.md").write_text("- [ ] task\n", encoding="utf-8")
    monitor = LoopBMonitor(workspace=str(root))
    result = monitor.scan("agent-1")
    assert result.status == "flagged"
    assert any(item["type"] == "repetitive_failure" for item in result.signals)


def test_scan_flags_placeholder_output(tmp_path):
    root = tmp_path / "workspace"
    agent_dir = root / "agents" / "agent-1"
    agent_dir.mkdir(parents=True)
    (agent_dir / "NOTES.md").write_text("all good", encoding="utf-8")
    (agent_dir / "TODO.md").write_text("- [ ] task\n", encoding="utf-8")
    (agent_dir / "REJECTED.md").write_text("Empty or placeholder output detected", encoding="utf-8")
    monitor = LoopBMonitor(workspace=str(root))
    result = monitor.scan("agent-1")
    assert result.status == "flagged"
    assert any(item["type"] == "placeholder_output" for item in result.signals)


def test_scan_flags_todo_stall(tmp_path):
    root = tmp_path / "workspace"
    agent_dir = root / "agents" / "agent-1"
    agent_dir.mkdir(parents=True)
    (agent_dir / "NOTES.md").write_text("all good", encoding="utf-8")
    (agent_dir / "TODO.md").write_text("- [ ] task 1\n- [ ] task 2\n", encoding="utf-8")
    (agent_dir / "REJECTED.md").write_text("", encoding="utf-8")
    monitor = LoopBMonitor(workspace=str(root))
    result = monitor.scan("agent-1")
    assert result.status == "flagged"
    assert any(item["type"] == "todo_stall" for item in result.signals)


def test_scan_ok_when_healthy(tmp_path):
    root = tmp_path / "workspace"
    agent_dir = root / "agents" / "agent-1"
    agent_dir.mkdir(parents=True)
    (agent_dir / "NOTES.md").write_text("all good", encoding="utf-8")
    (agent_dir / "TODO.md").write_text("- [x] done\n", encoding="utf-8")
    (agent_dir / "REJECTED.md").write_text("", encoding="utf-8")
    (agent_dir / "PERSONALITY.md").write_text("role: engineer", encoding="utf-8")
    monitor = LoopBMonitor(workspace=str(root))
    result = monitor.scan("agent-1")
    assert result.status == "ok"
    assert result.signals == []
