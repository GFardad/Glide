"""Tests for runtime execution backends."""

from __future__ import annotations

import time
from pathlib import Path

import pytest

from runtime.execution.backends import (
    BackendError,
    BackendResult,
    CliProcessBackend,
    ExecutionClient,
    ExecutionContext,
    HarnessBackend,
    PersistentKernelSession,
)


def _context(tmp_path: Path, agent_id: str = "agent-1") -> ExecutionContext:
    session_dir = tmp_path / "session"
    cwd = tmp_path / "cwd"
    session_dir.mkdir()
    cwd.mkdir()
    return ExecutionContext(session_id="s1", agent_id=agent_id, cwd=cwd, session_dir=session_dir)


def test_cli_process_backend_executes_command(tmp_path: Path):
    context = _context(tmp_path)
    backend = CliProcessBackend(env_allowlist=[])
    result = backend.execute(context, "python3 -c 'print(1)'")
    assert result.backend == "cli"
    assert result.returncode == 0
    assert result.stdout.strip() == "1"
    assert result.duration_ms >= 0


def test_cli_process_backend_raises_on_missing_command(tmp_path: Path):
    context = _context(tmp_path)
    backend = CliProcessBackend(env_allowlist=[])
    result = backend.execute(context, "nonexistent_command_xyz")
    assert result.returncode != 0


def test_persistent_kernel_session_preserves_history(tmp_path: Path):
    context = _context(tmp_path)
    session = PersistentKernelSession()
    first = BackendResult(returncode=0, stdout="", stderr="", duration_ms=1.0, backend="cli")
    session.snapshot(context, first)
    history = session.history(context)
    assert len(history) == 1
    assert history[0]["returncode"] == 0
    restored = PersistentKernelSession()
    restored.restore(context)
    assert len(restored.history(context)) == 1


def test_harness_backend_retries_then_succeeds(tmp_path: Path):
    context = _context(tmp_path)

    class FlakyBackend:
        attempts = 0

        def execute(self, context, command, **kwargs):
            FlakyBackend.attempts += 1
            if FlakyBackend.attempts < 2:
                raise BackendError("transient")
            return BackendResult(returncode=0, stdout="", stderr="", duration_ms=0.0, backend="cli")

    backend = HarnessBackend(FlakyBackend(), retry_budget=1)
    result = backend.execute(context, "cmd")
    assert result.returncode == 0


def test_execution_client_run_and_history(tmp_path: Path):
    context = _context(tmp_path)
    client = ExecutionClient()
    result = client.run(context, "python3 -c 'print(2)'")
    assert result.returncode == 0
    history = client.history(context)
    assert len(history) == 1
    assert history[0]["returncode"] == 0
