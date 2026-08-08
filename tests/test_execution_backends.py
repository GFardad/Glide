"""Tests for runtime execution backends."""

from __future__ import annotations

import json
import time
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from runtime.execution.backends import (
    BackendError,
    BackendResult,
    CliProcessBackend,
    ExecutionClient,
    ExecutionContext,
    HarnessBackend,
    HermesBackendError,
    HermesMCPBackend,
    PersistentKernelSession,
)


def _context(
    tmp_path: Path,
    agent_id: str = "agent-1",
    *,
    metadata: Optional[dict[str, Any]] = None,
) -> ExecutionContext:
    session_dir = tmp_path / "session"
    cwd = tmp_path / "cwd"
    session_dir.mkdir()
    cwd.mkdir()
    return ExecutionContext(
        session_id="s1",
        agent_id=agent_id,
        cwd=cwd,
        session_dir=session_dir,
        metadata=metadata or {},
    )


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


def test_hermes_mcp_backend_maps_success_to_backend_result(tmp_path: Path):
    context = _context(
        tmp_path,
        agent_id="agent-1",
        metadata={"objective": "build auth", "mode": "hybrid", "depth": 3},
    )
    fake_response = json.dumps({
        "jsonrpc": "2.0",
        "id": 1,
        "result": {
            "content": [{"type": "text", "text": '{"session_id":"abc","status":"ok"}'}],
        },
    })
    mock_process = MagicMock()
    mock_process.communicate.return_value = (fake_response, "")
    mock_process.returncode = 0
    mock_process.wait.return_value = 0

    with patch("subprocess.Popen", return_value=mock_process) as popen_mock:
        backend = HermesMCPBackend(call_timeout=5)
        result = backend.execute(context, "ignored command")

    popen_mock.assert_called_once()
    assert result.backend == "hermes_mcp"
    assert result.returncode == 0
    assert result.stdout == '{"session_id":"abc","status":"ok"}'
    assert "mcp_request" in result.metadata
    assert "mcp_response" in result.metadata


def test_hermes_mcp_backend_maps_error_to_nonzero_returncode(tmp_path: Path):
    context = _context(
        tmp_path,
        agent_id="agent-2",
        metadata={"objective": "do work"},
    )
    fake_response = json.dumps({
        "jsonrpc": "2.0",
        "id": 1,
        "error": {"code": -32600, "message": "Invalid Request"},
    })
    mock_process = MagicMock()
    mock_process.communicate.return_value = (fake_response, "mcp stderr")
    mock_process.returncode = 0
    mock_process.wait.return_value = 0

    with patch("subprocess.Popen", return_value=mock_process):
        backend = HermesMCPBackend(call_timeout=5)
        result = backend.execute(context, "ignored")

    assert result.backend == "hermes_mcp"
    assert result.returncode == 1
    assert result.stderr == "mcp stderr"
    assert result.metadata["mcp_response"] == {"code": -32600, "message": "Invalid Request"}


def test_hermes_mcp_backend_raises_on_abnormal_server_exit(tmp_path: Path):
    context = _context(tmp_path)
    mock_process = MagicMock()
    mock_process.communicate.return_value = ("", "")
    mock_process.returncode = 1
    mock_process.wait.return_value = 1

    with patch("subprocess.Popen", return_value=mock_process):
        backend = HermesMCPBackend(call_timeout=5)
        with pytest.raises(HermesBackendError):
            backend.execute(context, "ignored")


def test_hermes_mcp_backend_raises_on_invalid_json_response(tmp_path: Path):
    context = _context(tmp_path)
    mock_process = MagicMock()
    mock_process.communicate.return_value = ("not json", "")
    mock_process.returncode = 0
    mock_process.wait.return_value = 0

    with patch("subprocess.Popen", return_value=mock_process):
        backend = HermesMCPBackend(call_timeout=5)
        with pytest.raises(HermesBackendError):
            backend.execute(context, "ignored")


def test_hermes_mcp_backend_reaps_server_process(tmp_path: Path):
    context = _context(tmp_path)
    mock_process = MagicMock()
    mock_process.communicate.return_value = (
        json.dumps({"jsonrpc": "2.0", "id": 1, "result": {"content": [{"type": "text", "text": ""}]}}),
        "",
    )
    mock_process.returncode = 0
    mock_process.wait.return_value = 0

    with patch("subprocess.Popen", return_value=mock_process) as popen_mock:
        backend = HermesMCPBackend(call_timeout=5)
        backend.execute(context, "ignored")

    mock_process.kill.assert_called_once()
    mock_process.wait.assert_called_once()

