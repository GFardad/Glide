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


def test_handle_meeting_room():
    payload = json.loads(handle_tool("meeting_room", {"objective": "ship MVP"}))
    assert payload["status"] == "ok"
    assert payload["objective"] == "ship MVP"
    assert payload["recommendation"] in {"accept", "accept_with_notes", "revise"}
    assert isinstance(payload["roles_participated"], list)
    assert payload["roles_participated"]


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
    register_payload = json.loads(handle_tool("ceo_execute", {"command": "register_team", "payload": {"name": "broadcast-test", "config": {}}}))
    assert register_payload["status"] == "ok"
    payload = json.loads(handle_tool("ceo_execute", {"command": "broadcast", "payload": {"message": "sync now"}}))
    assert payload["status"] == "ok"
    assert payload["count"] >= 1


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


def test_handle_tool_validates_required_fields():
    payload = json.loads(handle_tool("glideloop_run", {}))
    assert payload["status"] == "error"
    assert "missing required fields" in payload["detail"]


def test_handle_tool_validates_argument_types():
    payload = json.loads(handle_tool("version_create", {"version": 123}))
    assert payload["status"] == "error"
    assert "validation_errors" in payload


def test_handle_loop_b_readiness():
    payload = json.loads(handle_tool("loop_b_readiness", {}))
    assert payload["status"] == "ok"
    assert payload["ready"] is True


def test_handle_ceo_spec_requires_objective():
    payload = json.loads(handle_tool("ceo_spec", {}))
    assert payload["status"] == "error"
    assert "objective" in payload["detail"]


def test_handle_ceo_plan_requires_spec_session_id():
    payload = json.loads(handle_tool("ceo_plan", {}))
    assert payload["status"] == "error"
    assert "spec_session_id" in payload["detail"]


def test_handle_ceo_build_requires_plan_session_id():
    payload = json.loads(handle_tool("ceo_build", {}))
    assert payload["status"] == "error"
    assert "plan_session_id" in payload["detail"]


def test_handle_ceo_test_requires_build_session_id():
    payload = json.loads(handle_tool("ceo_test", {}))
    assert payload["status"] == "error"
    assert "build_session_id" in payload["detail"]


def test_handle_ceo_review_requires_test_session_id():
    payload = json.loads(handle_tool("ceo_review", {}))
    assert payload["status"] == "error"
    assert "test_session_id" in payload["detail"]


def test_handle_ceo_ship_requires_review_session_id():
    payload = json.loads(handle_tool("ceo_ship", {}))
    assert payload["status"] == "error"
    assert "review_session_id" in payload["detail"]


def test_handle_ceo_pipeline_phases():
    spec = json.loads(handle_tool("ceo_spec", {"objective": "test pipeline", "session_id": "spec-1"}))
    assert spec["status"] == "ok"
    assert spec["phase"] == "spec"

    plan = json.loads(handle_tool("ceo_plan", {"spec_session_id": "spec-1", "session_id": "plan-1"}))
    assert plan["status"] == "ok"
    assert plan["phase"] == "plan"

    build = json.loads(handle_tool("ceo_build", {"plan_session_id": "plan-1", "session_id": "build-1"}))
    assert build["status"] == "ok"
    assert build["phase"] == "build"

    test_phase = json.loads(handle_tool("ceo_test", {"build_session_id": "build-1", "session_id": "test-1"}))
    assert test_phase["status"] == "ok"
    assert test_phase["phase"] == "test"

    review = json.loads(handle_tool("ceo_review", {"test_session_id": "test-1", "session_id": "review-1"}))
    assert review["status"] == "ok"
    assert review["phase"] == "review"

    ship = json.loads(handle_tool("ceo_ship", {"review_session_id": "review-1", "session_id": "ship-1"}))
    assert ship["status"] == "ok"
    assert ship["phase"] == "ship"


def test_handle_code_review_graph_missing_binary(monkeypatch):
    monkeypatch.setenv("PATH", "")
    payload = json.loads(handle_tool("code_review_graph", {"command": "status"}))
    assert payload["status"] == "error"
    assert "not found in PATH" in payload["detail"]


def test_handle_glideloop_schedule_requires_fields():
    payload = json.loads(handle_tool("glideloop_schedule", {}))
    assert payload["status"] == "error"


def test_handle_worker_status_missing():
    payload = json.loads(handle_tool("worker_status", {"root": "/tmp/does-not-exist"}))
    assert payload["status"] == "error"
    assert "not found" in payload["detail"]
