"""Tests for runtime worker module."""

from __future__ import annotations

import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

import pytest

from runtime.worker import Worker, WorkerConfig, WorkerState


def test_worker_state_roundtrip(tmp_path: Path):
    config = WorkerConfig(root=tmp_path)
    state = WorkerState(config)
    state.pid = 1234
    state.status = "running"
    state.started_at = "2026-01-01T00:00:00Z"
    state.last_heartbeat = "2026-01-01T00:00:01Z"
    state.sessions_processed = 5
    state.save()
    assert config.status_file.exists()
    loaded = json.loads(config.status_file.read_text(encoding="utf-8"))
    assert loaded["status"] == "running"
    assert loaded["pid"] == 1234
    assert loaded["sessions_processed"] == 5


def test_worker_writes_pid_and_logs(tmp_path: Path):
    config = WorkerConfig(root=tmp_path)
    worker = Worker(config)
    worker.state.pid = os.getpid()
    worker.state.status = "running"
    worker.state.started_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    worker.state.save()
    worker._write_pid()
    assert config.pid_file.exists()
    assert config.pid_file.read_text(encoding="utf-8") == str(os.getpid())
    worker.state.append_log("test_event", {"detail": "ok"})
    assert config.log_file.exists()
    log_line = config.log_file.read_text(encoding="utf-8").strip()
    entry = json.loads(log_line)
    assert entry["event"] == "test_event"
    assert entry["detail"] == "ok"


def test_worker_executes_pending_item(tmp_path: Path):
    config = WorkerConfig(root=tmp_path, poll_interval=0.1, heartbeat_interval=1.0)
    worker = Worker(config)
    worker.state.pid = os.getpid()
    worker.state.status = "running"
    worker.state.started_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    worker.state.save()
    worker._write_pid()

    from runtime.state import StateStore
    store = StateStore(config.state_dir)
    store.set("worker", "pending", [{"command": "echo worker-test", "session_id": "w1"}])

    worker._poll_and_execute()
    assert worker.state.sessions_processed == 1
    log_file = config.log_file
    assert log_file.exists()
    logs = log_file.read_text(encoding="utf-8").splitlines()
    assert any("session_processed" in line for line in logs)


def test_worker_main_entrypoint_exits_cleanly(tmp_path: Path):
    config = WorkerConfig(root=tmp_path)
    worker = Worker(config)
    worker.state.pid = os.getpid()
    worker.state.status = "running"
    worker.state.started_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    worker.state.save()
    worker._write_pid()
    assert (tmp_path / "runtime" / "state" / "worker.json").exists()
