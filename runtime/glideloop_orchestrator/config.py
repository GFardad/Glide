"""Glideloop Orchestrator configuration."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

__all__ = ["OrchestratorConfig"]


@dataclass
class OrchestratorConfig:
    root: Path = field(default_factory=lambda: Path(os.environ.get("GLIDELOOP_ROOT", "/home/gfardad/projects/glideloop")))
    runtime_dir: Path = field(init=False)
    workspace_dir: Path = field(init=False)
    sessions_dir: Path = field(init=False)
    state_dir: Path = field(init=False)
    meta_dir: Path = field(init=False)
    mcp_dir: Path = field(init=False)
    registry_dir: Path = field(init=False)
    default_depth: int = 3
    default_target_agents: int = 20
    max_parallel_sessions: int = 20
    max_concurrent_children: int = 5
    heartbeat_interval_seconds: int = 30
    session_timeout_seconds: int = 3600

    def __post_init__(self) -> None:
        self.runtime_dir = self.root / "runtime"
        self.workspace_dir = self.runtime_dir / "workspace"
        self.sessions_dir = self.runtime_dir / "sessions"
        self.state_dir = self.runtime_dir / "state"
        self.meta_dir = self.runtime_dir / "meta"
        self.mcp_dir = self.runtime_dir / "mcp"
        self.registry_dir = self.runtime_dir / "registry"
