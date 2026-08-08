"""Glideloop Orchestrator session lifecycle."""

from __future__ import annotations

import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
from uuid import uuid4

__all__ = ["Session", "create_session", "ensure_session_dirs"]

from .config import OrchestratorConfig

from runtime.logging import get_logger, log_event

_CONFIG = OrchestratorConfig()
_LOGGER = get_logger("glideloop.session")


def ensure_session_dirs(session_id: str) -> dict[str, Path]:
    base = _CONFIG.workspace_dir / session_id
    paths = {
        "root": base,
        "agents": base / "agents",
        "artifacts": base / "artifacts",
        "logs": base / "logs",
    }
    for path in paths.values():
        path.mkdir(parents=True, exist_ok=True)
    log_event(_LOGGER, "session_dirs_ensured", {"session_id": session_id, "paths": {key: str(value) for key, value in paths.items()}})
    return paths


@dataclass
class Session:
    session_id: str
    objective: str
    mode: str = "hybrid"
    depth: int = 3
    target_agents: int = 20
    status: str = "pending"
    cwd: Optional[Path] = None
    metadata: Optional[str] = None

    @classmethod
    def start(cls, objective: str, mode: str = "hybrid", depth: int = 3, target_agents: int = 20) -> "Session":
        session = cls(
            session_id=str(uuid4()),
            objective=objective,
            mode=mode,
            depth=depth,
            target_agents=target_agents,
            status="running",
        )
        paths = ensure_session_dirs(session.session_id)
        session.cwd = paths["root"]
        (paths["root"] / "GOAL.md").write_text(f"# Goal\n\n{objective}\n")
        (paths["root"] / "TODO.md").write_text("")
        (paths["root"] / "NOTES.md").write_text("")
        (paths["root"] / "REJECTED.md").write_text("")
        log_event(_LOGGER, "session_started", {"session_id": session.session_id, "objective": session.objective, "cwd": str(session.cwd)})
        return session
