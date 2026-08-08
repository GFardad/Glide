"""Loop B readiness probe.

Provides a lightweight health check for the Loop B monitoring,
intervention, and learning components.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class ReadinessProbe:
    monitor: bool = True
    intervention: bool = True
    learning: bool = True
    details: dict[str, Any] = field(default_factory=dict)


def readiness(workspace: str | None = None, root: str | None = None) -> ReadinessProbe:
    """Return Loop B readiness status from lightweight component checks."""
    details: dict[str, Any] = {}
    monitor_ready = False
    intervention_ready = False
    learning_ready = False

    try:
        from runtime.meta.loop_b.monitor import LoopBMonitor  # noqa: F401
        LoopBMonitor(workspace=workspace, root=root)
        monitor_ready = True
        details["monitor"] = "ok"
    except Exception as exc:
        details["monitor"] = f"error: {exc}"

    try:
        from runtime.meta.loop_b.intervention import LoopBIntervention  # noqa: F401
        LoopBIntervention(workspace=workspace)
        intervention_ready = True
        details["intervention"] = "ok"
    except Exception as exc:
        details["intervention"] = f"error: {exc}"

    try:
        from runtime.meta.loop_b.learning import LoopBMemory  # noqa: F401
        LoopBMemory(root=root)
        learning_ready = True
        details["learning"] = "ok"
    except Exception as exc:
        details["learning"] = f"error: {exc}"

    return ReadinessProbe(
        monitor=monitor_ready,
        intervention=intervention_ready,
        learning=learning_ready,
        details=details,
    )
