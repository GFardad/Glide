"""Tests for runtime MCP server tool dispatch."""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

import pytest

from runtime.mcp.server import _list_todos, _resolve_session_dir, handle_tool


def test_handle_glideloop_status():
    payload = json.loads(handle_tool("glideloop_status", {}))
    assert payload["status"] == "ok"
    assert "counters" in payload


def test_handle_glideloop_run():
    payload = json.loads(handle_tool("glideloop_run", {"objective": "build auth", "mode": "hybrid"}))
    assert payload["exit_code"] == 0
    assert payload["objective"] == "build auth"


def test_handle_glideloop_stop():
    payload = json.loads(handle_tool("glideloop_stop", {"session_id": "s1"}))
    assert payload["stopped"] == "s1"


def test_handle_glideloop_todos_create():
    payload = json.loads(handle_tool("glideloop_todos", {"action": "create", "content": "write tests", "priority": 5}))
    assert payload["created"] == "write tests"
    assert payload["session_id"] == "default"


def test_handle_glideloop_todos_list_empty(tmp_path, monkeypatch):
    monkeypatch.setenv("GLIDELOOP_WORKSPACE", str(tmp_path))
    session_dir = tmp_path / "default"
    session_dir.mkdir(parents=True)
    payload = _list_todos("default")
    assert payload["session_id"] == "default"
    assert payload["todos"] == []


def test_handle_glideloop_todos_list_with_items(tmp_path, monkeypatch):
    monkeypatch.setenv("GLIDELOOP_WORKSPACE", str(tmp_path))
    session_dir = tmp_path / "default"
    session_dir.mkdir(parents=True)
    (session_dir / "TODO.md").write_text("- [ ] task1\n- [x] task2\nrandom line\n", encoding="utf-8")
    payload = _list_todos("default")
    assert payload["todos"] == ["- [ ] task1", "- [x] task2"]


def test_handle_glideloop_meeting():
    payload = json.loads(handle_tool("glideloop_meeting", {"objective": "ship MVP"}))
    assert payload["objective"] == "ship MVP"
    assert "plan" in payload
    assert "architecture" in payload
    assert isinstance(payload["todos"], list)


def test_handle_glideloop_quality_missing_artifacts(tmp_path, monkeypatch):
    monkeypatch.setenv("GLIDELOOP_WORKSPACE", str(tmp_path))
    session_dir = tmp_path / "default"
    session_dir.mkdir(parents=True)
    payload = json.loads(handle_tool("glideloop_quality", {"session_id": "default"}))
    assert payload["session_id"] == "default"
    assert payload["passed"] is False
    assert payload["artifacts"] == []


def test_handle_glideloop_quality_with_artifacts(tmp_path, monkeypatch):
    monkeypatch.setenv("GLIDELOOP_WORKSPACE", str(tmp_path))
    session_dir = tmp_path / "default"
    session_dir.mkdir(parents=True)
    for name in ["GOAL.md", "TODO.md", "NOTES.md", "REJECTED.md"]:
        (session_dir / name).write_text("ok", encoding="utf-8")
    payload = json.loads(handle_tool("glideloop_quality", {"session_id": "default"}))
    assert payload["passed"] is True
    assert set(payload["artifacts"]) == {"GOAL.md", "TODO.md", "NOTES.md", "REJECTED.md"}


def test_handle_unknown_tool():
    payload = json.loads(handle_tool("unknown_tool", {}))
    assert "unknown tool" in payload["error"]


def test_handle_ceo_execute_register_team():
    payload = json.loads(handle_tool("ceo_execute", {"command": "register_team", "payload": {"name": "core", "config": {"version": "1.0"}}}))
    assert payload["status"] == "ok"
    assert payload["team"] == "core"


def test_handle_ceo_execute_broadcast():
    payload = json.loads(handle_tool("ceo_execute", {"command": "broadcast", "payload": {"message": "sync now"}}))
    assert payload["status"] == "ok"
    assert payload["count"] == 0


def test_handle_ceo_status():
    payload = json.loads(handle_tool("ceo_status", {}))
    assert payload["status"] == "ok"
    assert "teams" in payload


def test_handle_ceo_history():
    payload = json.loads(handle_tool("ceo_history", {}))
    assert payload["status"] == "ok"
    assert isinstance(payload["history"], list)


def test_handle_version_create(tmp_path, monkeypatch):
    monkeypatch.setenv("GLIDELOOP_ROOT", str(tmp_path))
    version = "1.0.0-test-1763915520"
    payload = json.loads(handle_tool("version_create", {"version": version, "codename": "alpha"}))
    assert payload["status"] == "ok"
    assert payload["version"] == version


def test_handle_version_list():
    payload = json.loads(handle_tool("version_list", {}))
    assert payload["status"] == "ok"
    assert "versions" in payload
