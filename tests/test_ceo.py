"""Tests for CEO runtime."""

from __future__ import annotations

import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

from runtime.ceo.ceo import CEO, CEOConfig


def test_ceo_execute_register_team():
    with tempfile.TemporaryDirectory() as tmp:
        ceo = CEO(CEOConfig(state_dir=Path(tmp)))
        result = ceo.execute("register_team", {"name": "core", "config": {"version": "1.0"}})
        assert result["status"] == "ok"
        assert result["team"] == "core"
        assert result["command"] == "register_team"


def test_ceo_execute_check_teams():
    with tempfile.TemporaryDirectory() as tmp:
        ceo = CEO(CEOConfig(state_dir=Path(tmp)))
        ceo.execute("register_team", {"name": "core"})
        result = ceo.execute("check_teams")
        assert result["status"] == "ok"
        assert "core" in result["teams"]


def test_ceo_execute_start_dev_session():
    with tempfile.TemporaryDirectory() as tmp:
        ceo = CEO(CEOConfig(state_dir=Path(tmp)))
        dev = ceo.execute("start_dev_session", {"session_id": "dev-1"})
        assert dev["status"] == "ok"
        assert dev["session_id"] == "dev-1"
        assert dev["role"] == "dev_cto"

        prod = ceo.execute("start_production_session", {"session_id": "prod-1"})
        assert prod["status"] == "error"
        assert "User must not access production" in prod["detail"]


def test_ceo_execute_merge_proposal():
    with tempfile.TemporaryDirectory() as tmp:
        ceo = CEO(CEOConfig(state_dir=Path(tmp)))
        with patch("runtime.manager.cto_manager.DecisionEngine") as mock_engine_cls:
            mock_engine = mock_engine_cls.return_value
            mock_decision = type("Decision", (), {"id": "decision-1"})()
            mock_engine.decide.return_value = mock_decision
            result = ceo.execute("merge_proposal", {"source": "feature/x", "target": "main", "tag": "merge-1"})
            assert result["status"] == "proposed"
            assert result["source"] == "feature/x"
            assert result["target"] == "main"


def test_ceo_execute_unknown_command():
    with tempfile.TemporaryDirectory() as tmp:
        ceo = CEO(CEOConfig(state_dir=Path(tmp)))
        result = ceo.execute("noop", {})
        assert result["status"] == "error"
        assert "unknown command" in result["detail"]


def test_ceo_history():
    with tempfile.TemporaryDirectory() as tmp:
        ceo = CEO(CEOConfig(state_dir=Path(tmp)))
        ceo.execute("register_team", {"name": "core"})
        ceo.execute("check_teams")
        history = ceo.history()
        assert len(history) == 2
        assert history[0]["command"] == "register_team"
        assert history[1]["command"] == "check_teams"


def test_ceo_execute_production_session_rejected():
    with tempfile.TemporaryDirectory() as tmp:
        ceo = CEO(CEOConfig(state_dir=Path(tmp)))
        result = ceo.execute("start_production_session", {"session_id": "prod-1"})
        assert result["status"] == "error"
        assert "User must not access production" in result["detail"]


class _FakeStateStore:
    """Minimal stand-in for runtime.state.StateStore used by daemon injection."""

    def __init__(self, initial=None):
        self._data = {"pending": list(initial or [])}

    def get(self, table, key):
        return list(self._data.get(key, []))

    def set(self, table, key, value):
        self._data[key] = list(value)

    def snapshot(self):
        return list(self._data.get("pending", []))


def test_session_recovery_task_supersedes_stale_phantom():
    """A fresh session_recovery injection must replace any prior one.

    Regression: a stale session_recovery task referencing sessions that no
    longer exist (e.g. phantom phase-* sessions) used to block the daemon's
    dedup-by-type logic, preventing real recovery work from ever being
    injected when a session genuinely went stale.
    """
    import scripts.ceo_daemon as daemon

    stale = {
        "id": "auto-1-session_recovery",
        "type": "session_recovery",
        "command": "python3 scripts/watchdog_batch.py",
        "context": {"objective": "Recover 7 stale sessions: phase-1 ..."},
    }
    store = _FakeStateStore([stale])
    with patch("runtime.state.StateStore", return_value=store), patch.object(
        daemon, "REPO_ROOT", Path("/tmp/glideloop-root")
    ):
        daemon.inject_improvement_task(
            "session_recovery",
            "python3 scripts/watchdog_batch.py --auto-recover",
            "Auto-recover 2 stale sessions: {stale: 2}",
        )
    recovery = [t for t in store.snapshot() if t.get("type") == "session_recovery"]
    assert len(recovery) == 1, recovery
    assert "2 stale sessions" in recovery[0]["context"]["objective"]
    assert "7 stale sessions" not in recovery[0]["context"]["objective"]


def test_quality_task_is_cumulative_by_type():
    """Non-recovery tasks still dedupe by type (no duplicate pending entry)."""
    import scripts.ceo_daemon as daemon

    existing = {"id": "auto-0-quality", "type": "quality", "command": "pytest"}
    store = _FakeStateStore([existing])
    with patch("runtime.state.StateStore", return_value=store), patch.object(
        daemon, "REPO_ROOT", Path("/tmp/glideloop-root")
    ):
        daemon.inject_improvement_task("quality", "pytest -q", "Run quality gates")
    pending = [t for t in store.snapshot() if t.get("type") == "quality"]
    assert len(pending) == 1, pending
