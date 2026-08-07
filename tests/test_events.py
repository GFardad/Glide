"""Tests for runtime events package."""

from __future__ import annotations

import json
import os

import pytest

from runtime.events import Event, EventRouter, emit, get_event_router


def test_event_validation_accepts_known_schema():
    event = Event(schema_name="ceo_command_received", payload={"command": "status", "payload": {}})
    event.validate()


def test_event_validation_rejects_unknown_schema():
    with pytest.raises(ValueError, match="unknown schema"):
        Event(schema_name="unknown_schema", payload={"foo": "bar"}).validate()


def test_event_router_writes_jsonl(tmp_path, monkeypatch):
    monkeypatch.setenv("GLIDELOOP_EVENTS", str(tmp_path))
    router = EventRouter(event_dir=tmp_path)
    router.route(Event(schema_name="ceo_command_received", payload={"command": "status", "payload": {}}))
    target = tmp_path / "ceo_command_received.jsonl"
    assert target.exists()
    lines = [line for line in target.read_text(encoding="utf-8").splitlines() if line.strip()]
    assert len(lines) == 1
    payload = json.loads(lines[0])
    assert payload["schema"] == "ceo_command_received"


def test_metrics_aggregates_counts(tmp_path, monkeypatch):
    monkeypatch.setenv("GLIDELOOP_EVENTS", str(tmp_path))
    router = EventRouter(event_dir=tmp_path)
    router.route(Event(schema_name="runner_completed", payload={"session_id": "s1", "agent_id": "a1", "returncode": 0}))
    router.route(Event(schema_name="runner_completed", payload={"session_id": "s2", "agent_id": "a2", "returncode": 0}))
    result = router.metrics()
    assert result["event_counts"]["runner_completed"] == 2
