"""Tests for runtime process manager."""

from __future__ import annotations

import os
import signal
import tempfile
from pathlib import Path

import pytest

from runtime.glideloop_orchestrator.processes import ProcessManager, ProcessRecord


def test_spawn_creates_record():
    manager = ProcessManager()
    record = ProcessRecord(
        job_id="job-1",
        session_id="s1",
        agent_id="a1",
        command=["python3", "-c", "print('hello')"],
        cwd=Path(tempfile.gettempdir()),
        env_allowlist=[],
    )
    manager.spawn(record)
    assert record.process is not None
    record.process.wait(timeout=10)
    assert record.process.poll() == 0
    assert "job-1" in manager._records


def test_stop_removes_record():
    manager = ProcessManager()
    record = ProcessRecord(
        job_id="job-2",
        session_id="s1",
        agent_id="a1",
        command=["python3", "-c", "import time; time.sleep(5)"],
        cwd=Path(tempfile.gettempdir()),
        env_allowlist=[],
    )
    manager.spawn(record)
    manager.stop("job-2")
    assert "job-2" not in manager._records


def test_stop_missing_job_is_noop():
    manager = ProcessManager()
    manager.stop("missing")  # should not raise
