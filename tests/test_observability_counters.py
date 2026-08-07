"""Tests for runtime observability counters."""

from __future__ import annotations

import threading

import pytest

from runtime.observability.counters import Counters, get_counters, increment, reset_counters


def test_reset_counters_returns_defaults():
    reset_counters()
    counters = get_counters()
    assert isinstance(counters, Counters)
    assert counters.sessions_started == 0


def test_increment_updates_counters():
    reset_counters()
    increment("sessions_started")
    increment("sessions_started")
    increment("todos_created")
    counters = get_counters()
    assert counters.sessions_started == 2
    assert counters.todos_created == 1
    assert counters.todos_merged == 0
    assert counters.loop_b_hints_injected == 0
    assert counters.loop_a_promotions == 0
    assert counters.loop_a_rollbacks == 0
    assert counters.mcp_tool_calls == 0


def test_increment_unknown_field_raises():
    with pytest.raises(AttributeError):
        increment("unknown_metric")


def test_counters_thread_safety():
    reset_counters()

    def worker():
        for _ in range(100):
            increment("sessions_started")

    threads = [threading.Thread(target=worker) for _ in range(5)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert get_counters().sessions_started == 500
