"""Glideloop resilient agent execution with circuit breaker and backoff."""

from __future__ import annotations

import json
import os
import random
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

from runtime.execution.backends import ExecutionClient

from runtime.glideloop_orchestrator.config import OrchestratorConfig
from runtime.logging import get_logger, log_event
from runtime.events import emit

__all__ = ["AgentContext", "AgentRunner", "SubagentContext", "SubagentSpawner", "DeadLetterQueue", "CircuitBreaker", "run_with_execution_backend"]

_CONFIG = OrchestratorConfig()
_FILE_CONTRACT = ("PERSONALITY.md", "GOAL.md", "NOTES.md", "TODO.md", "REJECTED.md")
_LOGGER = get_logger("glideloop.runner")
_EXECUTION_CLIENT = ExecutionClient()


@dataclass
class AgentContext:
    session_id: str
    agent_id: str
    team_id: str
    role: str
    cwd: Path
    parent_id: Optional[str] = None
    workspace: Optional[Path] = None

    def __post_init__(self) -> None:
        if self.workspace is None:
            object.__setattr__(self, "workspace", self.cwd.parent.parent)

    def ensure_contract(self) -> None:
        self.cwd.mkdir(parents=True, exist_ok=True)
        for name in _FILE_CONTRACT:
            path = self.cwd / name
            if not path.exists():
                path.write_text("")

    def append_note(self, note: str) -> None:
        path = self.cwd / "NOTES.md"
        timestamp = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()
        with path.open("a", encoding="utf-8") as handle:
            handle.write(f"\n## {timestamp}\n{note}\n")


class CircuitBreaker:
    """Circuit breaker for agent runs."""

    def __init__(self, failure_threshold: int = 3, recovery_timeout: float = 60.0) -> None:
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failures = 0
        self.last_failure_time = 0.0
        self.state = "closed"

    def allow_request(self) -> bool:
        if self.state == "closed":
            return True
        if self.state == "open" and time.time() - self.last_failure_time >= self.recovery_timeout:
            self.state = "half-open"
            return True
        return self.state != "open"

    def record_success(self) -> None:
        self.failures = 0
        self.state = "closed"

    def record_failure(self) -> None:
        self.failures += 1
        self.last_failure_time = time.time()
        if self.failures >= self.failure_threshold:
            self.state = "open"
            log_event(_LOGGER, "circuit_breaker_opened", {"failures": self.failures})
            emit("circuit_breaker_opened", {"failures": self.failures})


class DeadLetterQueue:
    """Dead-letter queue for failed agent runs."""

    def __init__(self, root: Optional[str | Path] = None) -> None:
        self.root = Path(root) if root else Path(os.environ.get("GLIDELOOP_ROOT", "/home/gfardad/projects/glideloop"))
        self.dlq_path = self.root / "runtime" / "state" / "dlq.json"
        self.dlq_path.parent.mkdir(parents=True, exist_ok=True)
        self._items = self._load()

    def _load(self) -> list[dict[str, Any]]:
        if self.dlq_path.exists():
            return json.loads(self.dlq_path.read_text(encoding="utf-8"))
        return []

    def _save(self) -> None:
        self.dlq_path.write_text(json.dumps(self._items, indent=2), encoding="utf-8")

    def enqueue(self, context: AgentContext, result: subprocess.CompletedProcess[str]) -> None:
        item = {
            "session_id": context.session_id,
            "agent_id": context.agent_id,
            "command": getattr(result, "args", ""),
            "returncode": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "timestamp": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        }
        self._items.append(item)
        self._save()
        log_event(_LOGGER, "dead_letter_queued", {"agent_id": context.agent_id, "returncode": result.returncode})
        emit("dead_letter_queued", item)

    def drain(self) -> list[dict[str, Any]]:
        items = list(self._items)
        self._items = []
        self._save()
        return items


class AgentRunner:
    def __init__(
        self,
        env_allowlist: Optional[list[str]] = None,
        loop_b: bool = False,
        retry_budget: int = 0,
        circuit_breaker: Optional[CircuitBreaker] = None,
        dlq: Optional[DeadLetterQueue] = None,
    ) -> None:
        self.env_allowlist = env_allowlist or list(os.environ.keys())
        self.loop_b = loop_b
        self.retry_budget = max(0, retry_budget)
        self.circuit_breaker = circuit_breaker or CircuitBreaker()
        self.dlq = dlq or DeadLetterQueue()

    def run(self, context: AgentContext, command: str) -> subprocess.CompletedProcess[str]:
        context.ensure_contract()
        allow = set(self.env_allowlist)
        env = {key: value for key, value in os.environ.items() if key in allow}
        last: Optional[subprocess.CompletedProcess[str]] = None
        max_attempts = self.retry_budget + 1
        started = time.time()
        log_event(_LOGGER, "runner_started", {"session_id": context.session_id, "agent_id": context.agent_id, "command": command, "retry_budget": self.retry_budget, "loop_b": self.loop_b})
        emit("runner_started", {"session_id": context.session_id, "agent_id": context.agent_id, "command": command, "retry_budget": self.retry_budget, "loop_b": self.loop_b})
        if not self.circuit_breaker.allow_request():
            failed = subprocess.CompletedProcess(args=command, returncode=-1, stdout="", stderr="circuit breaker open")
            self.dlq.enqueue(context, failed)
            emit("runner_circuit_open", {"agent_id": context.agent_id})
            return failed
        last = subprocess.CompletedProcess(args=command, returncode=-1, stdout="", stderr="")
        for attempt in range(1, max_attempts + 1):
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
                )
            except FileNotFoundError:
                result = subprocess.run(
                    command,
                    cwd=str(context.cwd),
                    env=env,
                    stdin=subprocess.DEVNULL,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    check=False,
                    text=True,
                    shell=True,
                )
                log_event(_LOGGER, "runner_shell_fallback", {"session_id": context.session_id, "agent_id": context.agent_id, "command": command})
                emit("runner_shell_fallback", {"session_id": context.session_id, "agent_id": context.agent_id, "command": command})
            last = result
            if result.returncode == 0 or attempt == max_attempts:
                if result.returncode == 0:
                    self.circuit_breaker.record_success()
                else:
                    self.circuit_breaker.record_failure()
                    self.dlq.enqueue(context, result)
                break
            with (context.cwd / "NOTES.md").open("a", encoding="utf-8") as handle:
                handle.write(f"\n## {__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat()}\nretry {attempt} failed rc={result.returncode}\n")
            log_event(_LOGGER, "runner_retry_failed", {"session_id": context.session_id, "agent_id": context.agent_id, "attempt": attempt, "returncode": result.returncode})
            emit("runner_retry_failed", {"session_id": context.session_id, "agent_id": context.agent_id, "attempt": attempt, "returncode": result.returncode})
            backoff = min((2 ** attempt) + random.uniform(0, 1), 30)
            time.sleep(backoff)
        if self.loop_b:
            self._apply_loop_b_hint(context)
        duration = (time.time() - started) * 1000
        log_event(_LOGGER, "runner_completed", {"session_id": context.session_id, "agent_id": context.agent_id, "returncode": last.returncode, "duration_ms": duration})
        emit("runner_completed", {"session_id": context.session_id, "agent_id": context.agent_id, "returncode": last.returncode, "duration_ms": duration})
        return last

    def _apply_loop_b_hint(self, context: AgentContext) -> None:
        from runtime.meta.loop_b.intervention import LoopBIntervention
        from runtime.meta.loop_b.monitor import LoopBMonitor

        scan = LoopBMonitor(workspace=str(context.workspace or context.cwd.parent)).scan(context.agent_id)
        if scan.status != "flagged":
            return
        hint = LoopBIntervention(workspace=str(context.workspace or context.cwd.parent)).maybe_hint(context.agent_id, scan=scan)
        if hint is None:
            return
        with (context.cwd / "NOTES.md").open("a", encoding="utf-8") as handle:
            handle.write(f"\n## {hint.timestamp}\n{hint.hint}\n")


class SubagentContext:
    def __init__(self, parent: AgentContext, subagent_id: str, role: str, objective: str) -> None:
        self.parent = parent
        self.subagent_id = subagent_id
        self.role = role
        self.objective = objective
        self.cwd = parent.cwd / "subagents" / subagent_id
        self.cwd.mkdir(parents=True, exist_ok=True)
        (self.cwd / "GOAL.md").write_text(f"# Subgoal\n\n{objective}\n")
        for name in _FILE_CONTRACT:
            if not (self.cwd / name).exists():
                (self.cwd / name).write_text("")


class SubagentSpawner:
    def __init__(self, runner: AgentRunner) -> None:
        self.runner = runner

    def spawn(self, context: SubagentContext, command: str) -> subprocess.CompletedProcess[str]:
        return self.runner.run(
            AgentContext(
                session_id=context.parent.session_id,
                agent_id=context.subagent_id,
                team_id=context.parent.team_id,
                role=context.role,
                cwd=context.cwd,
                parent_id=context.parent.agent_id,
                workspace=context.parent.workspace,
            ),
            command,
        )


def run_with_execution_backend(context: AgentContext, command: str, *, retry_budget: int = 0) -> subprocess.CompletedProcess[str]:
    execution_context = ExecutionContext(
        session_id=context.session_id,
        agent_id=context.agent_id,
        cwd=context.cwd,
        session_dir=context.workspace or context.cwd.parent,
        metadata={"team_id": context.team_id, "parent_id": context.parent_id},
    )
    client = ExecutionClient(retry_budget=retry_budget)
    result = client.run(execution_context, command)
    return subprocess.CompletedProcess(args=command, returncode=result.returncode, stdout=result.stdout, stderr=result.stderr)
