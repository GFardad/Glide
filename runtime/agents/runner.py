"""Glideloop Agent runtime.

Enforces the .md file contract for each agent:
- PERSONALITY.md
- GOAL.md
- NOTES.md
- TODO.md
- REJECTED.md
"""

from __future__ import annotations

import os
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

__all__ = ["AgentContext", "AgentRunner", "SubagentContext", "SubagentSpawner"]

from runtime.glideloop_orchestrator.config import OrchestratorConfig
from runtime.logging import get_logger, log_event

_CONFIG = OrchestratorConfig()
_FILE_CONTRACT = ("PERSONALITY.md", "GOAL.md", "NOTES.md", "TODO.md", "REJECTED.md")
_LOGGER = get_logger("glideloop.runner")


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


class AgentRunner:
    def __init__(self, env_allowlist: Optional[list[str]] = None, loop_b: bool = False, retry_budget: int = 0) -> None:
        self.env_allowlist = env_allowlist or list(os.environ.keys())
        self.loop_b = loop_b
        self.retry_budget = max(0, retry_budget)

    def run(self, context: AgentContext, command: str) -> subprocess.CompletedProcess:
        context.ensure_contract()
        allow = set(self.env_allowlist)
        env = {key: value for key, value in os.environ.items() if key in allow}
        last = None
        max_attempts = self.retry_budget + 1
        log_event(_LOGGER, "runner_started", {"session_id": context.session_id, "agent_id": context.agent_id, "command": command, "retry_budget": self.retry_budget, "loop_b": self.loop_b})
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
            last = result
            if result.returncode == 0 or attempt == max_attempts:
                break
            with (context.cwd / "NOTES.md").open("a", encoding="utf-8") as handle:
                handle.write(f"\n## {__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat()}\nretry {attempt} failed rc={result.returncode}\n")
            log_event(_LOGGER, "runner_retry_failed", {"session_id": context.session_id, "agent_id": context.agent_id, "attempt": attempt, "returncode": result.returncode})
        if self.loop_b:
            self._apply_loop_b_hint(context)
        log_event(_LOGGER, "runner_completed", {"session_id": context.session_id, "agent_id": context.agent_id, "returncode": last.returncode})
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

    def spawn(self, context: SubagentContext, command: str) -> subprocess.CompletedProcess:
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
