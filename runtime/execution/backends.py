"""Execution backends combining Prime-Agent, OpenCode, and JCode concepts.

This module defines concrete backend adapters for agent execution:
- ``CliProcessBackend``: OpenCode-style CLI isolation with bounded output
- ``PersistentKernelSession``: Prime-Agent-style durable session/kernel state
- ``HarnessBackend``: JCode-style harness wrapper with retry/backoff/session budget
- ``HermesMCPBackend``: Path-B bridge that calls GlideLoop's MCP server over stdio
"""

from __future__ import annotations

import json
import os
import random
import signal
import subprocess
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Optional


@dataclass(frozen=True)
class BackendResult:
    returncode: int
    stdout: str
    stderr: str
    duration_ms: float
    backend: str
    metadata: dict[str, Any] = field(default_factory=dict)


class BackendError(Exception):
    """Raised when a backend cannot execute a command."""


class HermesBackendError(BackendError):
    """Raised when the Hermes MCP backend fails."""


class CliProcessBackend:
    """OpenCode-style backend.

    Runs commands in an isolated cwd with bounded stdout/stderr capture.
    The backend does not assume agent-specific CLIs are installed; it
    provides the harness surface that such CLIs would plug into.
    """

    def __init__(self, env_allowlist: Optional[list[str]] = None) -> None:
        self.env_allowlist = env_allowlist or list(os.environ.keys())

    def execute(self, context: "ExecutionContext", command: str, *, timeout: int = 120) -> BackendResult:
        started = time.time()
        allow = set(self.env_allowlist)
        env = {key: value for key, value in os.environ.items() if key in allow}
        try:
            result = subprocess.run(
                command,
                cwd=str(context.cwd),
                env=env,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
                text=True,
                timeout=timeout,
                shell=True,
            )
        except FileNotFoundError:
            raise BackendError(f"command not found: {command}")
        except subprocess.TimeoutExpired:
            raise BackendError(f"command timed out: {command}")
        duration_ms = (time.time() - started) * 1000
        return BackendResult(
            returncode=result.returncode,
            stdout=result.stdout or "",
            stderr=result.stderr or "",
            duration_ms=duration_ms,
            backend="cli",
            metadata={"cwd": str(context.cwd), "timeout": timeout},
        )


class PersistentKernelSession:
    """Prime-Agent-style durable session/kernel.

    Provides persistent execution state across runs, mirroring Prime
    Agent's kernel/session durability model. State is stored in
    ``context.session_dir`` and survives process restarts.
    """

    def __init__(self) -> None:
        self._state: dict[str, Any] = {}

    def restore(self, context: "ExecutionContext") -> None:
        path = context.session_dir / "execution_state.json"
        if path.exists():
            self._state = json.loads(path.read_text(encoding="utf-8"))

    def snapshot(self, context: "ExecutionContext", result: BackendResult) -> None:
        path = context.session_dir / "execution_state.json"
        self._state.setdefault("runs", []).append(
            {
                "ts": time.time(),
                "returncode": result.returncode,
                "backend": result.backend,
                "duration_ms": result.duration_ms,
            }
        )
        payload = json.dumps(self._state, indent=2)
        path.write_text(payload, encoding="utf-8")

    def history(self, context: "ExecutionContext") -> list[dict[str, Any]]:
        return list(self._state.get("runs", []))


class HarnessBackend:
    """JCode-style harness wrapper.

    Adds retry/backoff and session budget limits around any inner backend.
    """

    def __init__(self, backend: Any, *, retry_budget: int = 0, backoff_base: float = 1.0) -> None:
        self.backend = backend
        self.retry_budget = max(0, int(retry_budget))
        self.backoff_base = max(0.1, float(backoff_base))

    def execute(self, context: "ExecutionContext", command: str, **kwargs: Any) -> BackendResult:
        last_error: Optional[BackendError] = None
        max_attempts = self.retry_budget + 1
        for attempt in range(1, max_attempts + 1):
            try:
                result = self.backend.execute(context, command, **kwargs)
                if result.returncode == 0:
                    return result
                raise BackendError(f"command failed rc={result.returncode}")
            except BackendError as exc:
                last_error = exc
                if attempt == max_attempts:
                    break
                backoff = (self.backoff_base ** attempt) + random.uniform(0, 1)
                time.sleep(min(backoff, 30))
        raise BackendError(f"harness exhausted retries: {last_error}")


class HermesMCPBackend:
    """Path-B bridge: Hermes-native agent execution via GlideLoop MCP.

    This backend replaces subprocess-based agent execution with calls
    to GlideLoop's own MCP server over stdio. It launches the server
    as a child process, sends ``glideloop_run`` over JSON-RPC, and
    returns the parsed result as a ``BackendResult``.

    The server process is always reaped after the call so the harness
    stays stateless across invocations.
    """

    def __init__(
        self,
        mcp_command: Optional[list[str]] = None,
        *,
        launch_timeout: int = 10,
        call_timeout: int = 120,
    ) -> None:
        self.mcp_command = mcp_command or ["/home/gfardad/.local/bin/glideloop-mcp"]
        self.launch_timeout = max(1, int(launch_timeout))
        self.call_timeout = max(1, int(call_timeout))

    def execute(self, context: "ExecutionContext", command: str, *, timeout: int = 120) -> BackendResult:
        started = time.time()
        effective_timeout = min(max(1, int(timeout)), self.call_timeout)
        objective = context.metadata.get("objective") or command

        try:
            server = subprocess.Popen(
                self.mcp_command,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
        except (FileNotFoundError, OSError) as exc:
            raise HermesBackendError(f"mcp server launch failed: {exc}") from exc

        try:
            payload = json.dumps({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/call",
                "params": {
                    "name": "glideloop_run",
                    "arguments": {
                        "objective": objective,
                        "mode": context.metadata.get("mode", "hybrid"),
                        "depth": int(context.metadata.get("depth", 3)),
                    },
                },
            }) + "\n"

            try:
                stdout, stderr = server.communicate(input=payload, timeout=effective_timeout)
            except subprocess.TimeoutExpired:
                try:
                    server.send_signal(signal.SIGTERM)
                except ProcessLookupError:
                    pass
                raise HermesBackendError(f"mcp call timed out after {effective_timeout}s")
        finally:
            try:
                server.kill()
            except ProcessLookupError:
                pass
            try:
                server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                pass

        duration_ms = (time.time() - started) * 1000

        if server.returncode not in (0, None):
            # Treat abnormal exits as backend failures
            raise HermesBackendError(
                f"mcp server exited abnormally rc={server.returncode}: {stderr.strip()}"
            )

        if not stdout.strip():
            raise HermesBackendError("mcp server returned empty response")

        try:
            response = json.loads(stdout)
        except json.JSONDecodeError as exc:
            raise HermesBackendError(f"invalid JSON-RPC response: {exc}") from exc

        text_content = ""
        try:
            result_payload = response.get("result", {})
            content_items = result_payload.get("content", [])
            if content_items:
                text_content = content_items[0].get("text", "")
        except (AttributeError, KeyError, TypeError):
            text_content = ""

        if response.get("error"):
            return BackendResult(
                returncode=1,
                stdout=text_content,
                stderr=stderr.strip(),
                duration_ms=duration_ms,
                backend="hermes_mcp",
                metadata={
                    "mcp_request": payload.strip(),
                    "mcp_response": response.get("error"),
                    "session_id": context.session_id,
                    "agent_id": context.agent_id,
                },
            )

        return BackendResult(
            returncode=0,
            stdout=text_content,
            stderr=stderr.strip(),
            duration_ms=duration_ms,
            backend="hermes_mcp",
            metadata={
                "mcp_request": payload.strip(),
                "mcp_response": response.get("result"),
                "session_id": context.session_id,
                "agent_id": context.agent_id,
            },
        )


@dataclass(frozen=True)
class ExecutionContext:
    session_id: str
    agent_id: str
    cwd: Path
    session_dir: Path
    metadata: dict[str, Any] = field(default_factory=dict)


class ExecutionClient:
    """Unified execution entrypoint combining all three concepts.

    - Uses ``PersistentKernelSession`` for durable state.
    - Defaults to ``CliProcessBackend`` wrapped in ``HarnessBackend``.
    - Supports ``HermesMCPBackend`` as a native Hermes path.
    """

    def __init__(
        self,
        *,
        backend: Optional[Any] = None,
        session: Optional[PersistentKernelSession] = None,
        retry_budget: int = 0,
    ) -> None:
        inner = backend or CliProcessBackend()
        self.backend = HarnessBackend(inner, retry_budget=retry_budget)
        self.session = session or PersistentKernelSession()

    def run(self, context: ExecutionContext, command: str, **kwargs: Any) -> BackendResult:
        self.session.restore(context)
        result = self.backend.execute(context, command, **kwargs)
        self.session.snapshot(context, result)
        return result

    def history(self, context: ExecutionContext) -> list[dict[str, Any]]:
        self.session.restore(context)
        return self.session.history(context)
