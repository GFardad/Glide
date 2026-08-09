"""Tests for Loop B runtime improvement monitor."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from runtime.meta.loop_b.monitor import LoopBMonitor, AgentScan


@pytest.fixture()
def monitor(tmp_path):
    workspace = tmp_path / "workspace"
    (workspace / "agents" / "default").mkdir(parents=True)
    return LoopBMonitor(workspace=str(workspace))


def test_scan_empty_artifacts(monitor):
    result = monitor.scan("default")
    assert result.status == "ok"
    assert result.signals == []


def test_scan_stuck_agent(monitor):
    agent = monitor.workspace / "agents" / "default" / "TODO.md"
    agent.write_text(
        "- [ ] implement auth\n- [ ] write tests\n- [ ] add docs\n",
        encoding="utf-8",
    )
    result = monitor.scan("default")
    assert result.status == "flagged"
    assert any(signal.get("type") == "todo_stall" for signal in result.signals)


def test_scan_quality_signal(monitor):
    agent = monitor.workspace / "agents" / "default" / "NOTES.md"
    agent.write_text("FIXME: temporary workaround needed\n", encoding="utf-8")
    result = monitor.scan("default")
    assert result.status == "flagged"
    assert any(signal.get("type") == "placeholder_output" for signal in result.signals)


def test_scan_repetitive_pattern(monitor):
    agent = monitor.workspace / "agents" / "default" / "NOTES.md"
    agent.write_text(
        "this is a long repeated line with enough length\n"
        "this is a long repeated line with enough length\n"
        "this is a long repeated line with enough length\n",
        encoding="utf-8",
    )
    result = monitor.scan("default")
    assert result.status == "flagged"
    assert any(signal.get("type") == "repetitive_failure" for signal in result.signals)
