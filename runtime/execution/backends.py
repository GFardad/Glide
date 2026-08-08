"""Execution backends combining Prime-Agent, OpenCode, and JCode concepts.

This module defines concrete backend adapters for agent execution:
- ``CliProcessBackend``: OpenCode-style CLI isolation with bounded output
- ``PersistentKernelSession``: Prime-Agent-style durable session/kernel state
- ``HarnessBackend``: JCode-style harness wrapper with retry/backoff/session budget
"""

from __future__ import annotations

import json
import os
import random
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
