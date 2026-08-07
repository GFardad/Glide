"""Tests for Loop B learning/memory."""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

from runtime.meta.loop_b.learning import LoopBMemory, InterventionRecord


def test_record_writes_jsonl(tmp_path):
    memory = LoopBMemory(root=str(tmp_path / "memory"))
    record = InterventionRecord(
        session_id="s1",
        agent_id="a1",
        timestamp="2026-08-08T00:00:00+00:00",
        signal="repetitive_failure",
        strategy="example_injection",
        outcome="success",
        quality_delta=0.2,
        notes="note",
    )
    path = memory.record(record)
    assert path.exists()
    assert path.suffix == ".jsonl"


def test_record_accepts_dict(tmp_path):
    memory = LoopBMemory(root=str(tmp_path / "memory"))
    path = memory.record(
        {
            "session_id": "s1",
            "agent_id": "a1",
            "timestamp": "2026-08-08T00:00:00+00:00",
            "signal": "repetitive_failure",
            "strategy": "example_injection",
            "outcome": "success",
        }
    )
    assert path.exists()


def test_extract_patterns_empty(tmp_path):
    memory = LoopBMemory(root=str(tmp_path / "memory"))
    assert memory.extract_patterns() == []


def test_extract_patterns_groups_by_signal_strategy(tmp_path):
    memory = LoopBMemory(root=str(tmp_path / "memory"))
    memory.record(
        InterventionRecord(
            session_id="s1",
            agent_id="a1",
            timestamp="2026-08-08T00:00:00+00:00",
            signal="repetitive_failure",
            strategy="example_injection",
            outcome="success",
        )
    )
    memory.record(
        InterventionRecord(
            session_id="s2",
            agent_id="a2",
            timestamp="2026-08-08T01:00:00+00:00",
            signal="repetitive_failure",
            strategy="example_injection",
            outcome="failure",
        )
    )
    patterns = memory.extract_patterns()
    assert len(patterns) == 1
    assert patterns[0]["success_rate"] == 0.5
