"""Glideloop observability counters."""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import Optional

from runtime.logging import get_logger, log_event

__all__ = ["Counters", "get_counters", "reset_counters", "increment"]

_LOGGER = get_logger("glideloop.observability")


@dataclass(frozen=True)
class Counters:
    sessions_started: int = 0
    todos_created: int = 0
    todos_merged: int = 0
    loop_b_hints_injected: int = 0
    loop_a_promotions: int = 0
    loop_a_rollbacks: int = 0
    mcp_tool_calls: int = 0


_COUNTERS = Counters()
_LOCK = threading.Lock()


def reset_counters() -> None:
    global _COUNTERS
    with _LOCK:
        _COUNTERS = Counters()


def get_counters() -> Counters:
    return _COUNTERS


def increment(name: str, amount: int = 1) -> None:
    global _COUNTERS
    if not hasattr(Counters, name):
        raise AttributeError(f"Counters has no counter {name}")
    with _LOCK:
        _COUNTERS = Counters(**{** _COUNTERS.__dict__, name: getattr(_COUNTERS, name) + amount})
    log_event(_LOGGER, "counter_incremented", {"name": name, "amount": amount, "value": getattr(_COUNTERS, name)})
