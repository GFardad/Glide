"""Tests for session watchdog."""

from __future__ import annotations

import json
import os
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

import pytest

from runtime.meta.watchdog.session_watchdog import (
    SessionHealth,
    SessionWatchdog,
    check_agent_health,
    main,
    _SESSION_MAX_AGE_SECONDS,
    _MAX_WORKER_AGE_SECONDS,
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _make_agent_dir(root: Path, agent_id: str, notes_ts: str | None = None) -> Path:
    agent_dir = root / agent_id
    agent_dir.mkdir(parents=True, exist_ok=True)
    (agent_dir / "GOAL.md").write_text("# Goal\n\nprobe\n", encoding="utf-8")
    (agent_dir / "NOTES.md").write_text(
        f"## {notes_ts or _now_iso()}\nheartbeat\n", encoding="utf-8"
    )
    (agent_dir / "TODO.md").write_text("", encoding="utf-8")
    (agent_dir / "REJECTED.md").write_text("", encoding="utf-8")
    return agent_dir


def _setup_state(root: Path, worker_pid: int | None = None, session_status: str | None = None, agent_id: str = "agent-1") -> None:
    state_dir = root / "runtime" / "state"
    state_dir.mkdir(parents=True, exist_ok=True)
    worker_json = {
        "pid": worker_pid or os.getpid(),
        "status": "running",
        "last_heartbeat": "2026-08-08T10:23:56Z",
        "sessions_processed": 10,
        "errors": [],
    }
    if worker_pid is None:
        worker_json = {}
    (state_dir / "worker.json").write_text(json.dumps(worker_json, ensure_ascii=False), encoding="utf-8")

    if session_status is not None:
        db_path = state_dir / "glideloop_orchestrator.sqlite"
        conn = sqlite3.connect(str(db_path))
        conn.execute(
            "CREATE TABLE IF NOT EXISTS sessions (session_id TEXT PRIMARY KEY, status TEXT, created_at TEXT)"
        )
        conn.execute(
            "INSERT OR REPLACE INTO sessions (session_id, status, created_at) VALUES (?, ?, ?)",
            (agent_id, session_status, "2026-08-08T09:00:00Z"),
        )
        conn.commit()
        conn.close()


def test_check_agent_health_ok(tmp_path: Path) -> None:
    _setup_state(tmp_path, worker_pid=os.getpid(), session_status="running", agent_id="agent-ok")
    agent_dir = _make_agent_dir(tmp_path, "agent-ok")
    result = check_agent_health(agent_dir, tmp_path)
    assert result.verdict == "ok"
    assert result.status == "running"


def test_check_agent_health_stale_no_logs(tmp_path: Path) -> None:
    _setup_state(tmp_path, worker_pid=os.getpid(), session_status="running", agent_id="agent-stale")
    workspace = tmp_path / "runtime" / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)
    agent_dir = _make_agent_dir(workspace, "agent-stale", notes_ts="2026-08-08T09:00:00Z")
    result = check_agent_health(agent_dir, tmp_path)
    assert result.verdict == "stale"


def test_check_agent_health_stuck_logs_gap(tmp_path: Path) -> None:
    _setup_state(tmp_path, worker_pid=os.getpid(), session_status="running", agent_id="agent-stuck")
    workspace = tmp_path / "runtime" / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)
    agent_dir = _make_agent_dir(workspace, "agent-stuck", notes_ts="2026-08-08T09:00:00Z")
    stale_ts = time.time() - (_MAX_WORKER_AGE_SECONDS + 60)
    (agent_dir / "logs").mkdir(exist_ok=True)
    (agent_dir / "logs" / "events.jsonl").write_text(json.dumps({"ts": stale_ts, "event": "heartbeat"}) + "\n", encoding="utf-8")
    result = check_agent_health(agent_dir, tmp_path)
    assert result.verdict == "stuck"


def test_check_agent_health_dead_status(tmp_path: Path) -> None:
    _setup_state(tmp_path, worker_pid=os.getpid(), session_status="failed", agent_id="agent-dead")
    agent_dir = _make_agent_dir(tmp_path, "agent-dead", notes_ts="2026-08-08T09:00:00Z")
    result = check_agent_health(agent_dir, tmp_path)
    assert result.verdict == "dead"
    assert result.status == "failed"


def test_check_agent_health_zombie_older_than_24h(tmp_path: Path) -> None:
    _setup_state(tmp_path, worker_pid=os.getpid(), session_status="running", agent_id="agent-zombie")
    very_old = "2026-08-01T09:00:00Z"
    agent_dir = _make_agent_dir(tmp_path, "agent-zombie", notes_ts=very_old)
    result = check_agent_health(agent_dir, tmp_path)
    assert result.verdict == "zombie"
    assert result.age_seconds > _SESSION_MAX_AGE_SECONDS


def test_check_agent_health_dead_pid_not_alive(tmp_path: Path) -> None:
    _setup_state(tmp_path, worker_pid=999999, session_status="running", agent_id="agent-pid-dead")
    agent_dir = _make_agent_dir(tmp_path, "agent-pid-dead", notes_ts="2026-08-08T09:00:00Z")
    result = check_agent_health(agent_dir, tmp_path)
    assert result.verdict == "dead"
    assert "pid" in result.detail


def test_watchdog_scan_sorted(tmp_path: Path) -> None:
    workspace = tmp_path / "runtime" / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)
    _setup_state(tmp_path, worker_pid=os.getpid(), session_status="running", agent_id="a-dead")
    for name in ("a-ok", "a-stuck", "a-dead"):
        agent_dir = _make_agent_dir(workspace, name, notes_ts="2026-08-08T09:00:00Z")
        if name == "a-dead":
            db_path = tmp_path / "runtime" / "state" / "glideloop_orchestrator.sqlite"
            conn = sqlite3.connect(str(db_path))
            conn.execute("INSERT OR REPLACE INTO sessions (session_id, status, created_at) VALUES (?, ?, ?)", (name, "failed", "2026-08-08T09:00:00Z"))
            conn.commit()
            conn.close()
        if name == "a-stuck":
            stale_ts = time.time() - (_MAX_WORKER_AGE_SECONDS + 60)
            (agent_dir / "logs").mkdir(exist_ok=True)
            (agent_dir / "logs" / "events.jsonl").write_text(json.dumps({"ts": stale_ts}) + "\n", encoding="utf-8")
    watchdog = SessionWatchdog(root=tmp_path)
    results = watchdog.scan()
    verdicts = [r.verdict for r in results]
    assert verdicts == sorted(verdicts, key=lambda v: {"dead": 0, "stuck": 1}.get(v, 2))


def test_watchdog_stale_or_worse_filters(tmp_path: Path) -> None:
    workspace = tmp_path / "runtime" / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)
    _setup_state(tmp_path, worker_pid=os.getpid(), session_status="running", agent_id="b-stuck")
    for name in ("b-ok", "b-stuck"):
        agent_dir = _make_agent_dir(workspace, name, notes_ts=_now_iso() if name == "b-ok" else "2026-08-08T09:00:00Z")
        if name == "b-stuck":
            stale_ts = time.time() - (_MAX_WORKER_AGE_SECONDS + 60)
            (agent_dir / "logs").mkdir(exist_ok=True)
            (agent_dir / "logs" / "events.jsonl").write_text(json.dumps({"ts": stale_ts}) + "\n", encoding="utf-8")
    watchdog = SessionWatchdog(root=tmp_path)
    stale = watchdog.stale_or_worse()
    assert len(stale) == 1
    assert stale[0].agent_id == "b-stuck"


def test_main_no_stale(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    with patch("runtime.meta.watchdog.session_watchdog.Path") as mock_path:
        mock_path.return_value = tmp_path
        rc = main([])
    captured = capsys.readouterr().out.strip()
    assert rc == 0
    assert "ok" in captured


def test_main_with_stale(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    _setup_state(tmp_path, worker_pid=os.getpid(), session_status="running", agent_id="agent-stuck")
    workspace = tmp_path / "runtime" / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)
    agent_dir = _make_agent_dir(workspace, "agent-stuck", notes_ts="2026-08-08T09:00:00Z")
    stale_ts = time.time() - (_MAX_WORKER_AGE_SECONDS + 60)
    (agent_dir / "logs").mkdir(exist_ok=True)
    (agent_dir / "logs" / "events.jsonl").write_text(json.dumps({"ts": stale_ts}) + "\n", encoding="utf-8")
    with patch("runtime.meta.watchdog.session_watchdog.Path") as mock_path:
        mock_path.return_value = tmp_path
        rc = main([])
    captured = capsys.readouterr().out.strip()
    assert rc == 1
    payload = json.loads(captured)
    assert payload["status"] == "stale"
    assert payload["stale"] >= 1
