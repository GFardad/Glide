"""Tests for runtime meeting room behavior."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from runtime.meeting_room.meeting import (
    MeetingBrief,
    MeetingRoom,
    PersonalityAgent,
    _architect_signals,
    _build_perspective,
    _derive_signals,
    _engineer_signals,
    _product_signals,
    _qa_signals,
    _security_signals,
)


def test_derive_signals_architect_missing_contract():
    signals = _derive_signals("architect", "ship fast without planning")
    assert "missing interface contract" in signals


def test_derive_signals_engineer_missing_rollback():
    signals = _derive_signals("engineer", "replace core module now")
    assert "no rollback path" in signals


def test_derive_signals_security_blocking_input_validation():
    signals = _derive_signals("security", "accept raw input and store it")
    assert any("blocking" in signal.lower() for signal in signals)


def test_derive_signals_qa_missing_criteria():
    signals = _derive_signals("qa", "ship it")
    assert "acceptance criteria missing" in signals


def test_build_perspective_returns_reviewed_files(tmp_path: Path):
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    perspective = _build_perspective("engineer", "add test coverage for robustness", workspace, project_root=tmp_path)
    assert "files" in perspective
    assert isinstance(perspective["files"], list)
    assert perspective["recommendation"] in {"accept", "accept_with_notes", "revise"}


def test_personality_agent_creates_artifacts(tmp_path: Path):
    workspace = tmp_path / "agent"
    agent = PersonalityAgent(role="qa", objective="ship MVP", workspace=workspace)
    result = agent.run()
    assert (workspace / "PERSONALITY.md").exists()
    assert (workspace / "GOAL.md").exists()
    assert (workspace / "NOTES.md").exists()
    assert result["role"] == "qa"


def test_meeting_room_brief_contains_roles_and_minutes(tmp_path: Path):
    minutes_dir = tmp_path / "minutes"
    room = MeetingRoom(objective="add robust e2e tests", roles=["engineer", "qa"], minutes_dir=str(minutes_dir), project_root=str(tmp_path))
    brief = room.run()
    assert isinstance(brief, MeetingBrief)
    assert brief.roles_participated == ["engineer", "qa"]
    assert brief.minutes_path
    assert Path(brief.minutes_path).exists()


def test_meeting_room_does_not_echo_objective_as_summary(tmp_path: Path):
    room = MeetingRoom(objective="ship MVP", minutes_dir=str(tmp_path / "minutes"), project_root=str(tmp_path))
    brief = room.run()
    content = Path(brief.minutes_path).read_text(encoding="utf-8")
    assert "Files reviewed:" in content
    assert "Suggested improvements:" in content
    non_objectice_lines = [line for line in content.splitlines() if line and "ship MVP" not in line]
    assert len(non_objectice_lines) >= 10
