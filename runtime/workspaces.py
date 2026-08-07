"""Glideloop branch-aware workspace isolation."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from runtime.logging import get_logger, log_event
from runtime.observability.counters import increment

__all__ = [
    "BranchWorkspace",
    "BranchWorkspaceManager",
    "create_branch_workspace",
    "get_branch_workspace_manager",
]

_LOGGER = get_logger("glideloop.workspaces")


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class BranchWorkspace:
    branch: str
    root: Path
    worktree_path: Path
    created_at: str = field(default_factory=_utcnow)
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_json(self) -> dict[str, Any]:
        return {
            "branch": self.branch,
            "root": str(self.root),
            "worktree_path": str(self.worktree_path),
            "created_at": self.created_at,
            "metadata": self.metadata,
        }


class BranchWorkspaceManager:
    """Manage per-branch workspaces using git worktrees."""

    def __init__(self, root: Optional[str | Path] = None) -> None:
        self.root = Path(root) if root else Path(os.environ.get("GLIDELOOP_ROOT", "/home/gfardad/projects/glideloop"))
        self.workspaces_dir = self.root / "runtime" / "workspaces"
        self.workspaces_dir.mkdir(parents=True, exist_ok=True)
        self.state_file = self.root / "runtime" / "state" / "branch-workspaces.json"
        self._state: dict[str, Any] = self._load()

    def _load(self) -> dict[str, Any]:
        if self.state_file.exists():
            return json.loads(self.state_file.read_text(encoding="utf-8"))
        return {"workspaces": {}}

    def _save(self) -> None:
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        self.state_file.write_text(json.dumps(self._state, indent=2), encoding="utf-8")

    def create(self, branch: str, base_branch: str = "main") -> BranchWorkspace:
        worktree_path = self.workspaces_dir / f"{branch}-{int(datetime.now(timezone.utc).timestamp())}"
        try:
            subprocess.run(["git", "worktree", "add", str(worktree_path), "-b", branch, f"origin/{base_branch}"], cwd=str(self.root), check=True, capture_output=True)
        except subprocess.CalledProcessError as exc:
            log_event(_LOGGER, "workspace_create_failed", {"branch": branch, "error": str(exc)})
            raise
        workspace = BranchWorkspace(branch=branch, root=self.root, worktree_path=worktree_path)
        self._state["workspaces"][branch] = workspace.to_json()
        self._save()
        increment("workspaces_created")
        log_event(_LOGGER, "workspace_created", workspace.to_json())
        return workspace

    def remove(self, branch: str) -> None:
        data = self._state.get("workspaces", {}).get(branch)
        if not data:
            return
        path = Path(data["worktree_path"])
        if path.exists():
            shutil.rmtree(path, ignore_errors=True)
        try:
            subprocess.run(["git", "worktree", "remove", str(path)], cwd=str(self.root), check=False, capture_output=True)
        except Exception as exc:
            log_event(_LOGGER, "workspace_remove_failed", {"branch": branch, "error": str(exc)})
        self._state.setdefault("workspaces", {}).pop(branch, None)
        self._save()
        log_event(_LOGGER, "workspace_removed", {"branch": branch})

    def get(self, branch: str) -> Optional[BranchWorkspace]:
        data = self._state.get("workspaces", {}).get(branch)
        if not data:
            return None
        return BranchWorkspace(**data)

    def list_workspaces(self) -> list[dict[str, Any]]:
        return list(self._state.get("workspaces", {}).values())


def create_branch_workspace(branch: str, base_branch: str = "main") -> BranchWorkspace:
    manager = get_branch_workspace_manager()
    return manager.create(branch, base_branch=base_branch)


def get_branch_workspace_manager() -> BranchWorkspaceManager:
    global _BRANCH_WORKSPACE_MANAGER
    with _BRANCH_LOCK:
        if _BRANCH_WORKSPACE_MANAGER is None:
            _BRANCH_WORKSPACE_MANAGER = BranchWorkspaceManager()
        return _BRANCH_WORKSPACE_MANAGER


_BRANCH_WORKSPACE_MANAGER: Optional[BranchWorkspaceManager] = None
_BRANCH_LOCK = __import__("threading").Lock()
