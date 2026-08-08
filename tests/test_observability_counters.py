"""Tests for runtime observability counters."""

from __future__ import annotations

import threading

import pytest

from runtime.observability.counters import Counters, get_counters, increment, reset_counters, snapshot, total


def test_reset_counters_returns_zero_total():
    reset_counters()
    assert total() == 0


def test_increment_increases_specific_counter():
    reset_counters()
    increment("sessions_started", amount=3)
    counters = get_counters()
    assert counters.sessions_started == 3
    assert total() == 3


def test_increment_unknown_counter_raises():
    reset_counters()
    with pytest.raises(AttributeError):
        increment("nonexistent_counter")


def test_snapshot_returns_dict_with_all_fields():
    reset_counters()
    increment("sessions_started")
    data = snapshot()
    assert isinstance(data, dict)
    assert "sessions_started" in data
    assert data["sessions_started"] == 1


def test_total_aggregates_all_counters():
    reset_counters()
    increment("sessions_started")
    increment("todos_created")
    assert total() == 2


def test_counters_are_thread_safe():
    reset_counters()
    barrier = threading.Barrier(4)
    def worker() -> None:
        barrier.wait()
        for _ in range(25):
            increment("sessions_started")
    threads = [threading.Thread(target=worker) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert get_counters().sessions_started == 100
