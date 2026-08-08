"""Glideloop dev environment runtime."""

from __future__ import annotations

import json
import os
import subprocess
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from runtime.logging import get_logger, log_event
from runtime.observability.counters import increment
from runtime.quality.gates import PromotionGate
from runtime.state import StateStore

__all__ = [
    "BranchStatus",
    "DevEnvironment",
    "DevSession",
    "create_dev_env",
    "get_dev_env",
]

_LOGGER = get_logger("glideloop.dev_env")


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class BranchStatus:
    branch: str
    ahead: int = 0
    behind: int = 0
    last_commit: str = ""
    last_message: str = ""
    updated_at: str = field(default_factory=_utcnow)


@dataclass
class DevSession:
    session_id: str
    branch: str = "dev"
    role: str = "dev_cto"
    workspace: Path = field(default_factory=lambda: Path("/tmp/glideloop-dev"))
    pid: int | None = None
    status: str = "idle"  # idle | running | blocked | ready
    last_output: str = ""
    created_at: str = field(default_factory=_utcnow)
    updated_at: str = field(default_factory=_utcnow)

    def to_json(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "branch": self.branch,
            "role": self.role,
            "workspace": str(self.workspace),
            "pid": self.pid,
            "status": self.status,
            "last_output": self.last_output,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


class DevEnvironment:
    def __init__(self, root: str | Path | None = None) -> None:
        self.root = Path(root) if root else Path(os.environ.get("GLIDELOOP_ROOT", "/home/gfardad/projects/glideloop"))
        state_dir = self.root / "runtime" / "state"
        state_dir.mkdir(parents=True, exist_ok=True)
        self._store = StateStore(state_dir)
        self._state: dict[str, Any] = self._load()

    def _load(self) -> dict[str, Any]:
        stored = self._store.get("dev_env", "state")
        if stored:
            return stored
        return {
            "dev": None,
            "branches": {},
            "releases": [],
            "gates": {},
        }

    def _save(self) -> None:
        self._store.set("dev_env", "state", self._state)

    def create_dev_session(self, session_id: str, workspace: str | Path | None = None) -> DevSession:
        session = DevSession(
            session_id=session_id,
            workspace=Path(workspace) if workspace else Path(f"/tmp/glideloop-dev/{session_id}"),
        )
        self._state["dev"] = session.to_json()
        self._save()
        log_event(_LOGGER, "dev_session_created", {"session_id": session_id})
        increment("dev_sessions_created")
        return session

    def get_dev_session(self) -> DevSession | None:
        data = self._state.get("dev")
        if not data:
            return None
        return DevSession(**data)

    def update_dev_status(self, status: str, last_output: str = "") -> None:
        dev = self.get_dev_session()
        if not dev:
            return
        dev.status = status
        dev.last_output = last_output
        dev.updated_at = _utcnow()
        self._state["dev"] = dev.to_json()
        self._save()
        log_event(_LOGGER, "dev_status_updated", {"session_id": dev.session_id, "status": status})

    def get_branch_status(self, branch: str) -> BranchStatus:
        try:
            result = subprocess.run(
                ["git", "branch", "-v"],
                cwd=str(self.root),
                capture_output=True,
                text=True,
                check=False,
            )
            lines = result.stdout.strip().splitlines()
            for line in lines:
                if line.startswith(f"* {branch}"):
                    parts = line.split()
                    return BranchStatus(
                        branch=branch,
                        last_commit=parts[1] if len(parts) > 1 else "",
                        last_message=" ".join(parts[2:]) if len(parts) > 2 else "",
                    )
        except Exception as exc:
            log_event(_LOGGER, "branch_status_error", {"branch": branch, "error": str(exc)})
        return BranchStatus(branch=branch)

    def approve_dev(self, tag: str | None = None) -> bool:
        dev = self.get_dev_session()
        if not dev:
            return False
        gate = PromotionGate(self.root)
        checks = gate.check()
        if not checks["accepted"]:
            log_event(_LOGGER, "dev_approval_rejected", {"dev_session_id": dev.session_id, "checks": checks})
            return False
        log_event(_LOGGER, "dev_approved", {"dev_session_id": dev.session_id})
        increment("dev_approvals_completed")
        return True

    def promote_to_release(self, tag: str | None = None) -> str | None:
        if (self.root / "runtime" / "dev_env.py").exists():
            log_event(_LOGGER, "release_promotion_blocked", {"reason": "promote_to_release is not allowed on the live GlideLoop repo"})
            return None
        version = tag or f"release-{_utcnow()[:10]}"
        try:
            subprocess.run(["git", "checkout", "main"], cwd=str(self.root), check=True, capture_output=True)
            subprocess.run(["git", "merge", "dev", "--squash", "--no-edit"], cwd=str(self.root), check=True, capture_output=True)
            subprocess.run(["git", "commit", "-m", f"Merge dev into release {version}"], cwd=str(self.root), check=True, capture_output=True)
            subprocess.run(["git", "tag", "-a", version, "-m", f"Release {version}"], cwd=str(self.root), check=True, capture_output=True)
            subprocess.run(["git", "push", "origin", "main", "--follow-tags"], cwd=str(self.root), check=True, capture_output=True)
            subprocess.run(["git", "checkout", "dev"], cwd=str(self.root), check=True, capture_output=True)
        except subprocess.CalledProcessError as exc:
            log_event(_LOGGER, "release_promotion_failed", {"version": version, "error": str(exc)})
            return None
        self._state.setdefault("releases", []).append({"version": version, "promoted_at": _utcnow()})
        self._save()
        log_event(_LOGGER, "release_promoted", {"version": version})
        increment("releases_promoted")
        return version

    def get_status(self) -> dict[str, Any]:
        dev = self.get_dev_session()
        return {
            "dev": dev.to_json() if dev else None,
            "releases": self._state.get("releases", []),
        }


def create_dev_env(root: str | Path | None = None) -> DevEnvironment:
    return DevEnvironment(root=root)


def get_dev_env(root: str | Path | None = None) -> DevEnvironment:
    return DevEnvironment(root=root)


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Glideloop dev environment runtime")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("status", help="Show dev session status")
    subparsers.add_parser("dev", help="Start/ensure dev session")
    promote_parser = subparsers.add_parser("promote", help="Promote dev branch to release")
    promote_parser.add_argument("--tag", required=False, help="Release tag, e.g. release-2026.08.07")

    args = parser.parse_args()
    env = DevEnvironment()
    if args.command == "status":
        print(json.dumps(env.get_status(), indent=2))
    elif args.command == "dev":
        if not env.get_dev_session():
            env.create_dev_session(f"dev-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}")
        env.update_dev_status("running")
        print("Dev session started")
    elif args.command == "promote":
        version = env.promote_to_release(tag=args.tag)
        if version is None:
            print("Release promotion failed")
            raise SystemExit(1)
        print(f"Promoted {version}")


if __name__ == "__main__":
    main()
