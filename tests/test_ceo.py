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
        assert prod["status"] == "ok"
        assert prod["session_id"] == "prod-1"
        assert prod["role"] == "production_cto"


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
