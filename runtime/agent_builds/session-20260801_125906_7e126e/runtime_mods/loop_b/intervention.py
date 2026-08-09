"""Loop B intervention strategies."""

from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

__all__ = ["Intervention", "LoopBIntervention", "loop_b_hint"]

_COOLDOWN_SECONDS = 900


@dataclass(frozen=True)
class Intervention:
    agent_id: str
    strategy: str
    hint: str
    timestamp: str


class LoopBIntervention:
    def __init__(self, workspace: Optional[str] = None) -> None:
        self.workspace = Path(workspace) if workspace else Path("/tmp/glideloop-workspace")
        self._last_hints: dict[str, float] = {}

    def maybe_hint(self, agent_id: str, scan: "AgentScan") -> Optional[Intervention]:  # noqa: F821
        if scan.status != "flagged":
            return None
        if not self._cooldown_ok(agent_id):
            return None
        strategy, hint = self._choose(scan)
        if not hint:
            return None
        timestamp = _utcnow()
        notes = self.workspace / "agents" / agent_id / "NOTES.md"
        try:
            with notes.open("a", encoding="utf-8") as handle:
                handle.write(f"\n## {timestamp}\n{hint}\n")
        except Exception:
            pass
        self._last_hints[agent_id] = time.time()
        return Intervention(agent_id=agent_id, strategy=strategy, hint=hint, timestamp=timestamp)

    def _choose(self, scan: "AgentScan") -> tuple[str, str]:  # noqa: F821
        for signal in scan.signals:
            stype = signal.get("type")
            if stype == "repetitive_failure":
                return "example_injection", _example_injection_hint(signal.get("detail", []))
            if stype == "placeholder_output":
                return "format_constraint", _format_constraint_hint()
            if stype == "rejection_spam":
                return "prompt_patch", _prompt_patch_hint()
            if stype == "todo_stall":
                return "task_decomposition", _task_decomposition_hint()
            if stype == "missing_personality":
                return "role_reminder", _role_reminder_hint()
        return "context_reframe", _context_reframe_hint()

    def _cooldown_ok(self, agent_id: str) -> bool:
        last = self._last_hints.get(agent_id)
        if last is None:
            return True
        return (time.time() - last) >= _COOLDOWN_SECONDS


def loop_b_hint(workspace: Optional[str], agent_id: str, scan: "AgentScan") -> Optional[Intervention]:  # noqa: F821
    return LoopBIntervention(workspace=workspace).maybe_hint(agent_id, scan)


def _utcnow() -> str:
    import datetime
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def _context_reframe_hint() -> str:
    return "Loop B hint: restate the original GOAL.md acceptance criteria before continuing."


def _example_injection_hint(details: list[str]) -> str:
    examples = "\n".join(f"- {item}" for item in details[-3:])
    return f"Loop B hint: repeated failure pattern detected:\n{examples}\nAdjust approach before retrying."


def _format_constraint_hint() -> str:
    return "Loop B hint: previous attempt was rejected for placeholder output. Next attempt must provide concrete, specific output."


def _prompt_patch_hint() -> str:
    return "Loop B hint: previous attempt was rejected. Next attempt must satisfy GOAL.md and avoid the failure pattern in REJECTED.md."


def _task_decomposition_hint() -> str:
    return "Loop B hint: break the current TODO into the smallest next executable step and write it as the first pending item."


def _role_reminder_hint() -> str:
    return "Loop B hint: missing or empty PERSONALITY.md detected. Restate your role mandate before continuing."
