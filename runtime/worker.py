"""GlideLoop execution consumer / worker.

This module provides a long-lived background worker that:
- polls for pending sessions/tasks
- executes via AgentRunner + ExecutionClient
- writes results to agent artifacts
- emits events and updates counters
- reports heartbeat for monitoring
"""

from __future__ import annotations

import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Optional

from runtime.logging import get_logger, log_event
from runtime.observability.counters import increment

__all__ = ["WorkerConfig", "WorkerState", "Worker", "main"]

_LOGGER = get_logger("glideloop.worker")


class WorkerConfig:
    """Configuration for the GlideLoop worker."""

    def __init__(
        self,
        root: Optional[str | Path] = None,
        poll_interval: float = 5.0,
        heartbeat_interval: float = 30.0,
        team: str = "production",
    ) -> None:
        self.root = Path(root) if root else Path(os.environ.get("GLIDELOOP_ROOT", "/home/gfardad/projects/glideloop"))
        self.poll_interval = poll_interval
        self.heartbeat_interval = heartbeat_interval
        self.team = team
        self.state_dir = self.root / "runtime" / "state"
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.log_dir = self.root / "runtime" / "state" / "logs"
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.pid_file = self.state_dir / "worker.pid"
        self.status_file = self.state_dir / "worker.json"
        self.log_file = self.log_dir / "worker.jsonl"


class WorkerState:
    """Worker runtime state."""

    def __init__(self, config: WorkerConfig) -> None:
        self.config = config
        self.pid: Optional[int] = None
        self.status: str = "starting"
        self.started_at: Optional[str] = None
        self.last_heartbeat: Optional[str] = None
        self.sessions_processed: int = 0
        self.errors: list[str] = []

    def to_dict(self) -> dict[str, Any]:
        return {
            "pid": self.pid,
            "status": self.status,
            "team": self.config.team,
            "started_at": self.started_at,
            "last_heartbeat": self.last_heartbeat,
            "sessions_processed": self.sessions_processed,
            "errors": self.errors[-10:],
        }

    def save(self) -> None:
        payload = json.dumps(self.to_dict(), indent=2)
        self.config.status_file.write_text(payload, encoding="utf-8")

    def append_log(self, event: str, data: dict[str, Any]) -> None:
        entry = {
            "ts": time.time(),
            "event": event,
            "pid": self.pid,
            "team": self.config.team,
            **data,
        }
        with self.config.log_file.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(entry, ensure_ascii=False) + "\n")


class Worker:
    """GlideLoop execution consumer."""

    def __init__(self, config: Optional[WorkerConfig] = None) -> None:
        self.config = config or WorkerConfig()
        self.state = WorkerState(self.config)
        self._shutdown = False

    def run(self) -> int:
        """Main worker loop."""
        self.state.pid = os.getpid()
        self.state.status = "running"
        self.state.started_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        self.state.save()
        self._write_pid()
        self.state.append_log("worker_started", {"pid": self.state.pid})
        log_event(_LOGGER, "worker_started", {"pid": self.state.pid, "team": self.config.team})

        signal.signal(signal.SIGTERM, self._handle_signal)
        signal.signal(signal.SIGINT, self._handle_signal)

        last_heartbeat = 0.0
        while not self._shutdown:
            now = time.time()
            try:
                self._poll_and_execute()
            except Exception as exc:
                self.state.errors.append(str(exc))
                self.state.append_log("worker_error", {"error": str(exc)})
                log_event(_LOGGER, "worker_error", {"error": str(exc)})

            if now - last_heartbeat >= self.config.heartbeat_interval:
                self.state.last_heartbeat = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                self.state.save()
                self.state.append_log("heartbeat", {
                    "sessions_processed": self.state.sessions_processed,
                    "errors": len(self.state.errors),
                })
                last_heartbeat = now

            time.sleep(self.config.poll_interval)

        self.state.status = "stopped"
        self.state.save()
        self.state.append_log("worker_stopped", {"sessions_processed": self.state.sessions_processed})
        log_event(_LOGGER, "worker_stopped", {"sessions_processed": self.state.sessions_processed})
        return 0

    def _poll_and_execute(self) -> None:
        """Poll for pending work and execute."""
        # Check CEO broadcast queue / StateStore for pending work
        try:
            from runtime.state import StateStore
            store = StateStore(self.config.state_dir)
            pending = store.get("worker", "pending")
        except Exception:
            pending = None

        work_items = []
        if isinstance(pending, list):
            work_items = pending
        elif isinstance(pending, dict):
            work_items = [pending]

        if not work_items:
            return

        for item in work_items[:1]:
            try:
                self._execute_item(item)
                self.state.sessions_processed += 1
                self.state.append_log("session_processed", {"item": item})
            except Exception as exc:
                self.state.append_log("execution_failed", {"item": item, "error": str(exc)})
                log_event(_LOGGER, "worker_execution_failed", {"error": str(exc)})

    def _execute_item(self, item: dict[str, Any]) -> None:
        """Execute a single work item via execution backend."""
        command = item.get("command") or item.get("objective") or "echo hello"
        session_id = item.get("session_id") or f"worker-{time.time_ns()}"
        cwd = Path(item.get("cwd") or self.config.root / "runtime" / "workspace" / session_id)
        cwd.mkdir(parents=True, exist_ok=True)

        from runtime.execution.backends import ExecutionClient, ExecutionContext
        from runtime.agents.runner import AgentContext, AgentRunner

        context = AgentContext(
            session_id=session_id,
            agent_id=item.get("agent_id", "worker"),
            team_id=self.config.team,
            role="worker",
            cwd=cwd,
        )
        runner = AgentRunner(env_allowlist=[], retry_budget=1)
        result = runner.run(context, command)
        increment("mcp_tool_calls")
        self.state.append_log("execution_result", {
            "session_id": session_id,
            "returncode": result.returncode,
            "stdout": result.stdout[:500] if result.stdout else "",
            "stderr": result.stderr[:500] if result.stderr else "",
        })

    def _write_pid(self) -> None:
        self.config.pid_file.write_text(str(self.state.pid), encoding="utf-8")

    def _handle_signal(self, signum: int, _frame: Any) -> None:
        """Handle shutdown signals."""
        self.state.append_log("signal_received", {"signal": signum})
        self._shutdown = True


def main(argv: Optional[list[str]] = None) -> int:
    """Entrypoint for the worker."""
    config = WorkerConfig()
    worker = Worker(config)
    return worker.run()


if __name__ == "__main__":
    sys.exit(main())
