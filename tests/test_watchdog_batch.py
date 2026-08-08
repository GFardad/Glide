"""Tests for parallel batch watchdog."""

from __future__ import annotations

import json
import os
import sqlite3
import time
from pathlib import Path
from unittest.mock import patch

import pytest

from scripts.watchdog_batch import _check_single_agent, run_parallel_health_checks


def _make_agent_dir(root: Path, agent_id: str, notes_ts: str | None = None, add_log: bool = False) -> Path:
    agent_dir = root / "runtime" / "workspace" / agent_id
    agent_dir.mkdir(parents=True, exist_ok=True)
    (agent_dir / "GOAL.md").write_text("# Goal\n\nprobe\n", encoding="utf-8")
    ts = notes_ts or "2026-08-08T09:00:00Z"
    (agent_dir / "NOTES.md").write_text(f"## {ts}\nheartbeat\n", encoding="utf-8")
    (agent_dir / "TODO.md").write_text("", encoding="utf-8")
    (agent_dir / "REJECTED.md").write_text("", encoding="utf-8")
    if add_log:
        logs = agent_dir / "logs"
        logs.mkdir(exist_ok=True)
        (logs / "events.jsonl").write_text(json.dumps({"ts": time.time(), "event": "heartbeat"}) + "\n", encoding="utf-8")
    return agent_dir


def _setup_state(root: Path, session_status: str | None = None, agent_id: str = "agent-1") -> None:
    state_dir = root / "runtime" / "state"
    state_dir.mkdir(parents=True, exist_ok=True)
    if session_status is not None:
        db_path = state_dir / "glideloop_orchestrator.sqlite"
        conn = sqlite3.connect(str(db_path))
        conn.execute("CREATE TABLE IF NOT EXISTS sessions (session_id TEXT PRIMARY KEY, status TEXT, created_at TEXT)")
        conn.execute("INSERT OR REPLACE INTO sessions (session_id, status, created_at) VALUES (?, ?, ?)", (agent_id, session_status, "2026-08-08T09:00:00Z"))
        conn.commit()
        conn.close()


def test_check_single_agent_stuck(tmp_path: Path) -> None:
    _setup_state(tmp_path, session_status="running", agent_id="stuck")
    agent_dir = _make_agent_dir(tmp_path, "stuck", notes_ts="2026-08-08T09:00:00Z", add_log=True)
    stale_ts = time.time() - (15 * 60 + 60)
    (agent_dir / "logs" / "events.jsonl").write_text(json.dumps({"ts": stale_ts, "event": "heartbeat"}) + "\n", encoding="utf-8")
    result = _check_single_agent("stuck", tmp_path)
    assert result["verdict"] == "stuck"


def test_check_single_agent_dead_status(tmp_path: Path) -> None:
    _setup_state(tmp_path, session_status="failed", agent_id="dead")
    agent_dir = _make_agent_dir(tmp_path, "dead", notes_ts="2026-08-08T09:00:00Z")
    result = _check_single_agent("dead", tmp_path)
    assert result["verdict"] == "dead"


def test_check_single_agent_ok(tmp_path: Path) -> None:
    _setup_state(tmp_path, session_status="running", agent_id="ok")
    agent_dir = _make_agent_dir(tmp_path, "ok", add_log=True)
    result = _check_single_agent("ok", tmp_path)
    assert result["verdict"] == "ok"


def test_run_parallel_health_checks_empty(tmp_path: Path) -> None:
    with patch("scripts.watchdog_batch.Path") as mock_path:
        mock_path.return_value = tmp_path
        report = run_parallel_health_checks(root=tmp_path)
    assert report["status"] == "ok"
    assert report["checked"] == 0
