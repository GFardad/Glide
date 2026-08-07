"""Glideloop event pipeline with typed schemas and router."""

from __future__ import annotations

import json
import logging
import os
import threading
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Optional

from runtime.logging import get_logger, log_event, mask_payload

__all__ = ["Event", "EventSchema", "EventRouter", "get_event_router", "emit", "metrics"]

_LOGGER = get_logger("glideloop.events")
_EVENT_DIR = Path(os.environ.get("GLIDELOOP_EVENTS", "/tmp/glideloop-events"))
_EVENT_DIR.mkdir(parents=True, exist_ok=True)
_ROUTER_LOCK = threading.Lock()
_ROUTER: Optional["EventRouter"] = None


@dataclass(frozen=True)
class EventSchema:
    """Typed schema for an event category."""

    name: str
    required: tuple[str, ...] = ()
    optional: tuple[str, ...] = ()


_SCHEMAS = [
    EventSchema("ceo_command_received", required=("command", "payload")),
    EventSchema("ceo_command_completed", required=("command", "status")),
    EventSchema("manager_team_registered", required=("name", "config")),
    EventSchema("manager_team_synced", required=("team", "status")),
    EventSchema("manager_broadcast", required=("deliveries", "count")),
    EventSchema("manager_escalation", required=("team", "reason", "timestamp")),
    EventSchema("merge_proposed", required=("decision_id", "source", "target")),
    EventSchema("promotion_proposed", required=("decision_id", "tag")),
    EventSchema("runner_started", required=("session_id", "agent_id", "command")),
    EventSchema("runner_completed", required=("session_id", "agent_id", "returncode")),
    EventSchema("dev_session_started", required=("session_id",)),
    EventSchema("production_session_started", required=("session_id",)),
    EventSchema("version_created", required=("version", "codename")),
    EventSchema("version_activated", required=("version", "status")),
    EventSchema("version_released", required=("version", "status", "released_at")),
    EventSchema("runner_shell_fallback", required=("session_id", "agent_id", "command")),
    EventSchema("runner_retry_failed", required=("session_id", "agent_id", "attempt", "returncode")),
    EventSchema("runner_circuit_open", required=("agent_id",)),
    EventSchema("dead_letter_queued", required=("session_id", "agent_id", "command", "returncode")),
    EventSchema("promotion_gate_checked", required=("tests_pass", "no_merge_conflicts", "required_artifacts", "accepted")),
]


@dataclass
class Event:
    """Typed event envelope."""

    schema_name: str
    payload: dict[str, Any]
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    correlation_id: Optional[str] = None

    def validate(self) -> None:
        schema = next((s for s in _SCHEMAS if s.name == self.schema_name), None)
        if schema is None:
            raise ValueError(f"unknown schema: {self.schema_name}")
        missing = [key for key in schema.required if key not in self.payload]
        if missing:
            raise ValueError(f"{self.schema_name} missing keys: {missing}")


class EventRouter:
    """Route events to log files, metrics, and in-memory subscribers."""

    def __init__(self, event_dir: Path = _EVENT_DIR) -> None:
        self.event_dir = event_dir
        self.event_dir.mkdir(parents=True, exist_ok=True)
        self._counts: dict[str, int] = defaultdict(int)
        self._subscribers: list[Callable[[Event], None]] = []
        self._lock = threading.Lock()

    def subscribe(self, fn: Callable[[Event], None]) -> None:
        with self._lock:
            self._subscribers.append(fn)

    def route(self, event: Event) -> None:
        event.validate()
        masked = mask_payload(event.payload)
        envelope = {
            "schema": event.schema_name,
            "timestamp": event.timestamp,
            "correlation_id": event.correlation_id,
            "payload": masked,
        }
        line = json.dumps(envelope, ensure_ascii=False)
        target = self.event_dir / f"{event.schema_name}.jsonl"
        with target.open("a", encoding="utf-8") as handle:
            handle.write(f"{line}\n")
        with self._lock:
            self._counts[event.schema_name] += 1
            for fn in list(self._subscribers):
                try:
                    fn(event)
                except Exception as exc:
                    _LOGGER.warning("event subscriber failed: %s", exc)

    def metrics(self) -> dict[str, Any]:
        with self._lock:
            return {"event_counts": dict(self._counts)}


def get_event_router() -> EventRouter:
    global _ROUTER
    with _ROUTER_LOCK:
        if _ROUTER is None:
            _ROUTER = EventRouter()
        return _ROUTER


def emit(schema_name: str, payload: dict[str, Any], correlation_id: Optional[str] = None) -> None:
    router = get_event_router()
    router.route(Event(schema_name=schema_name, payload=payload, correlation_id=correlation_id))
    log_event(_LOGGER, f"event.{schema_name}", {"schema": schema_name, "correlation_id": correlation_id})
