"""Tests for runtime glideloop orchestrator session + real glideloop_run flow."""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

from runtime.glideloop_orchestrator.config import OrchestratorConfig
from runtime.glideloop_orchestrator.main import main
from runtime.glideloop_orchestrator.session import Session
from runtime.registry.agent import TodoRegistryAgent


def test_session_start_creates_directory():
    with tempfile.TemporaryDirectory() as tmp:
        session = Session.start(objective="demo")
        assert session.session_id
        assert session.objective == "demo"
        assert session.cwd.exists()
        assert (session.cwd / "agents").exists()


def test_glideloop_run_writes_session(tmp_path, monkeypatch):
    root = tmp_path / "glideloop"
    root.mkdir()
    monkeypatch.setenv("GLIDELOOP_ROOT", str(root))
    exit_code = main(["run", "demo"])
    assert exit_code == 0


def test_real_todo_creation_flow():
    session = Session.start(objective="demo")
    db = session.cwd / "registry.sqlite"
    registry = TodoRegistryAgent(db_path=str(db))
    result = registry.propose(agent_id="cto", session_id=session.session_id, content="draft plan")
    assert result["decision"] == "create"
