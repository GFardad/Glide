"""Tests for parallel batch watchdog."""

from __future__ import annotations

import json
import os
import sqlite3
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from unittest.mock import patch

import pytest

from scripts.watchdog_batch import (
    _check_single_agent,
    recover_sessions,
    run_parallel_health_checks,
)


def _make_agent_dir(root: Path, agent_id: str, notes_ts: str | None = None, add_log: bool = False) -> Path:
    agent_dir = root / "runtime" / "workspace" / agent_id
    agent_dir.mkdir(parents=True, exist_ok=True)
    (agent_dir / "GOAL.md").write_text("# Goal\n\nprobe\n", encoding="utf-8")
    ts = notes_ts or datetime.now(timezone.utc).isoformat()
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
    stale_ts = (datetime.now(timezone.utc) - timedelta(minutes=16)).isoformat()
    agent_dir = _make_agent_dir(tmp_path, "stuck", notes_ts=stale_ts, add_log=True)
    log_ts = time.time() - (15 * 60 + 60)
    (agent_dir / "logs" / "events.jsonl").write_text(json.dumps({"ts": log_ts, "event": "heartbeat"}) + "\n", encoding="utf-8")
    result = _check_single_agent("stuck", tmp_path)
    assert result["verdict"] == "stuck"


def test_check_single_agent_dead_status(tmp_path: Path) -> None:
    _setup_state(tmp_path, session_status="failed", agent_id="dead")
    agent_dir = _make_agent_dir(tmp_path, "dead", notes_ts="2026-08-08T09:00:00Z", add_log=True)
    result = _check_single_agent("dead", tmp_path)
    assert result["verdict"] == "dead"


def test_check_single_agent_ok(tmp_path: Path) -> None:
    _setup_state(tmp_path, session_status="running", agent_id="ok")
    agent_dir = _make_agent_dir(tmp_path, "ok", add_log=True)
    result = _check_single_agent("ok", tmp_path)
    assert result["verdict"] == "ok"


def test_run_parallel_health_checks_empty(tmp_path: Path) -> None:
    with patch("scripts.watchdog_batch._run_watchdog") as mock_scan:
        mock_scan.return_value = {"status": "stale", "stale": 0, "items": []}
        report = run_parallel_health_checks(root=tmp_path)
    assert report["status"] == "ok"
    assert report["checked"] == 0


def test_run_parallel_health_checks_scan_error(tmp_path: Path) -> None:
    """A failing/empty watchdog scan must surface as error, not be masked as ok."""
    with patch("scripts.watchdog_batch._run_watchdog") as mock_scan:
        mock_scan.return_value = {"status": "error", "stale": 0, "items": []}
        report = run_parallel_health_checks(root=tmp_path)
    assert report["status"] == "error"
    assert report["checked"] == 0


def test_recover_archives_orphan_without_db_record(tmp_path: Path) -> None:
    """A stale session with NO orchestrator DB record is an orphan and must be
    archived, not restarted. Restarting orphans spawns phantom workspaces that
    re-accumulate forever (the bug fixed in recover_sessions)."""
    _make_agent_dir(tmp_path, "orphan", add_log=False)
    with patch("scripts.watchdog_batch._run_watchdog") as mock_scan, patch(
        "scripts.watchdog_batch._check_single_agent"
    ) as mock_check, patch("scripts.watchdog_batch._restart_session") as mock_restart:
        mock_scan.return_value = {
            "status": "stale",
            "stale": 1,
            "items": [{"session_id": "orphan"}],
        }
        mock_check.return_value = {
            "session_id": "orphan",
            "verdict": "stale",
            "status": "unknown",  # no DB record
            "worker_alive": False,
            "age_seconds": 100000,
        }
        report = recover_sessions(root=tmp_path)
    # The orphan workspace must be archived (moved under .archive), not restarted.
    mock_restart.assert_not_called()
    assert report["recovered"] == 1
    action = report["actions"][0]
    assert action["action"] == "archive"
    assert action["reason"] == "orphan_no_db_record"
    # Workspace directory is moved out of runtime/workspace.
    assert not (tmp_path / "runtime" / "workspace" / "orphan").exists()
    assert (tmp_path / "runtime" / "workspace" / ".archive" / "orphan").exists()


def test_recover_restarts_genuine_stuck_session(tmp_path: Path) -> None:
    """A stale session with a DB record AND a genuinely live worker must still
    be restarted (not archived)."""
    _make_agent_dir(tmp_path, "stuck", add_log=False)
    with patch("scripts.watchdog_batch._run_watchdog") as mock_scan, patch(
        "scripts.watchdog_batch._check_single_agent"
    ) as mock_check, patch("scripts.watchdog_batch._restart_session") as mock_restart:
        mock_restart.return_value = {"session_id": "stuck", "action": "restart", "result": {}}
        mock_scan.return_value = {
            "status": "stale",
            "stale": 1,
            "items": [{"session_id": "stuck"}],
        }
        mock_check.return_value = {
            "session_id": "stuck",
            "verdict": "stale",
            "status": "running",
            "worker_alive": True,
            "age_seconds": 100000,
        }
        report = recover_sessions(root=tmp_path)
    mock_restart.assert_called_once()
    assert report["recovered"] == 1
    assert report["actions"][0]["action"] == "restart"
    # Genuine session is NOT archived.
    assert (tmp_path / "runtime" / "workspace" / "stuck").exists()


def test_recover_archives_phantom_running_session(tmp_path: Path) -> None:
    """A stale session with a DB row but NO live worker (pid missing/dead) is a
    PHANTOM and must be archived, not restarted. Restarting it only spawns
    another workspace and the pile never drains (the leak seen across prior
    cycles: 104 -> 212 -> 224 stale workspaces)."""
    _make_agent_dir(tmp_path, "phantom", add_log=False)
    with patch("scripts.watchdog_batch._run_watchdog") as mock_scan, patch(
        "scripts.watchdog_batch._check_single_agent"
    ) as mock_check, patch("scripts.watchdog_batch._restart_session") as mock_restart:
        mock_scan.return_value = {
            "status": "stale",
            "stale": 1,
            "items": [{"session_id": "phantom"}],
        }
        mock_check.return_value = {
            "session_id": "phantom",
            "verdict": "stale",
            "status": "running",  # has a DB row...
            "worker_alive": False,  # ...but no live worker
            "age_seconds": 100000,
        }
        report = recover_sessions(root=tmp_path)
    # A phantom must NOT be restarted (that re-accumulates the pile).
    mock_restart.assert_not_called()
    assert report["recovered"] == 1
    action = report["actions"][0]
    assert action["action"] == "archive"
    assert action["reason"] == "phantom_no_live_worker"
    # Workspace is drained out of runtime/workspace.
    assert not (tmp_path / "runtime" / "workspace" / "phantom").exists()
    assert (tmp_path / "runtime" / "workspace" / ".archive" / "phantom").exists()
