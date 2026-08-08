"""Tests for runtime.glideloop_orchestrator.main."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

import pytest

from runtime.glideloop_orchestrator.main import main


def test_main_no_argv_returns_zero():
    assert main([]) == 0


def test_main_run_returns_zero_and_prints_session(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("GLIDELOOP_ROOT", str(tmp_path))
    fake_session = type("FakeSession", (), {"session_id": "abc", "cwd": str(tmp_path / "cwd"), "objective": "demo", "mode": "hybrid", "depth": 3, "target_agents": 20, "status": "running"})()
    with patch("runtime.glideloop_orchestrator.session.Session") as mock_session_cls, patch("runtime.glideloop_orchestrator.state.OrchestratorState") as mock_state_cls:
        mock_session_cls.start.return_value = fake_session
        mock_state_cls.return_value.__enter__.return_value = type("FakeConn", (), {"execute": lambda *args, **kwargs: None, "commit": lambda *args, **kwargs: None})()
        exit_code = main(["run", "demo"])
    assert exit_code == 0


def test_main_unknown_command_returns_one(capsys: pytest.CaptureFixture[str]):
    exit_code = main(["unknown"])
    assert exit_code == 1
    captured = capsys.readouterr()
    assert "unknown command: unknown" in captured.out
