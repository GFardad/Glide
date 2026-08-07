"""Glideloop dev environment: production CTO controls dev CTO via MCP."""

from __future__ import annotations

import json
import os
import subprocess
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from runtime.logging import get_logger, log_event
from runtime.observability.counters import increment
from runtime.quality.gates import PromotionGate

__all__ = [
    "BranchStatus",
    "DevEnvironment",
    "DevSession",
    "ProductionSession",
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
    pid: Optional[int] = None
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


@dataclass
class ProductionSession:
    session_id: str
    branch: str = "main"
    role: str = "production_cto"
    workspace: Path = field(default_factory=lambda: Path("/tmp/glideloop-prod"))
    dev_session_id: Optional[str] = None
    release_version: Optional[str] = None
    status: str = "idle"  # idle | reviewing | approving | releasing
    created_at: str = field(default_factory=_utcnow)
    updated_at: str = field(default_factory=_utcnow)

    def to_json(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "branch": self.branch,
            "role": self.role,
            "workspace": str(self.workspace),
            "dev_session_id": self.dev_session_id,
            "release_version": self.release_version,
            "status": self.status,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


class DevEnvironment:
    def __init__(self, root: Optional[str | Path] = None) -> None:
        self.root = Path(root) if root else Path(os.environ.get("GLIDELOOP_ROOT", "/home/gfardad/projects/glideloop"))
        self.state_file = self.root / "runtime" / "state" / "dev_env.json"
        self._state: dict[str, Any] = self._load()

    def _load(self) -> dict[str, Any]:
        if self.state_file.exists():
            return json.loads(self.state_file.read_text(encoding="utf-8"))
        return {
            "production": None,
            "dev": None,
            "branches": {},
            "releases": [],
            "gates": {},
        }

    def _save(self) -> None:
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        self.state_file.write_text(json.dumps(self._state, indent=2), encoding="utf-8")

    def create_production_session(self, session_id: str, workspace: Optional[str | Path] = None) -> ProductionSession:
        session = ProductionSession(
            session_id=session_id,
            workspace=Path(workspace) if workspace else Path(f"/tmp/glideloop-prod/{session_id}"),
        )
        self._state["production"] = session.to_json()
        self._save()
        log_event(_LOGGER, "production_session_created", {"session_id": session_id})
        increment("production_sessions_created")
        return session

    def create_dev_session(self, session_id: str, workspace: Optional[str | Path] = None) -> DevSession:
        session = DevSession(
            session_id=session_id,
            workspace=Path(workspace) if workspace else Path(f"/tmp/glideloop-dev/{session_id}"),
        )
        self._state["dev"] = session.to_json()
        self._save()
        log_event(_LOGGER, "dev_session_created", {"session_id": session_id})
        increment("dev_sessions_created")
        return session

    def get_production_session(self) -> Optional[ProductionSession]:
        data = self._state.get("production")
        if not data:
            return None
        return ProductionSession(**data)

    def get_dev_session(self) -> Optional[DevSession]:
        data = self._state.get("dev")
        if not data:
            return None
        return DevSession(**data)

    def link_sessions(self, production_id: str, dev_id: str) -> None:
        prod = self.get_production_session()
        dev = self.get_dev_session()
        if prod and dev:
            prod.dev_session_id = dev_id
            dev.status = "controlled"
            self._state["production"] = prod.to_json()
            self._state["dev"] = dev.to_json()
            self._save()
            log_event(_LOGGER, "sessions_linked", {"production_id": production_id, "dev_id": dev_id})

    def update_dev_status(self, status: str, last_output: str = "") -> None:
        dev = self.get_dev_session()
        if dev:
            dev.status = status
            dev.last_output = last_output
            dev.updated_at = _utcnow()
            self._state["dev"] = dev.to_json()
            self._save()
            log_event(_LOGGER, "dev_status_updated", {"session_id": dev.session_id, "status": status})

    def update_production_status(self, status: str) -> None:
        prod = self.get_production_session()
        if prod:
            prod.status = status
            prod.updated_at = _utcnow()
            self._state["production"] = prod.to_json()
            self._save()
            log_event(_LOGGER, "production_status_updated", {"session_id": prod.session_id, "status": status})

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

    def approve_dev(self) -> bool:
        prod = self.get_production_session()
        dev = self.get_dev_session()
        if not prod or not dev:
            return False
        self.update_production_status("approving")
        log_event(_LOGGER, "dev_approval_started", {"dev_session_id": dev.session_id})
        increment("dev_approvals_started")
        gate = PromotionGate(self.root)
        checks = gate.check()
        if not checks["accepted"]:
            log_event(_LOGGER, "dev_approval_rejected", {"dev_session_id": dev.session_id, "checks": checks})
            self.update_production_status("idle")
            return False
        self.update_production_status("idle")
        log_event(_LOGGER, "dev_approved", {"dev_session_id": dev.session_id})
        increment("dev_approvals_completed")
        return True

    def promote_to_release(self, tag: Optional[str] = None) -> Optional[str]:
        prod = self.get_production_session()
        dev = self.get_dev_session()
        if not prod or not dev:
            return None
        self.update_production_status("releasing")
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
            self.update_production_status("idle")
            return None
        self._state.setdefault("releases", []).append({
            "version": version,
            "promoted_at": _utcnow(),
            "dev_session_id": dev.session_id,
        })
        prod.release_version = version
        self._state["production"] = prod.to_json()
        self._save()
        self.update_production_status("idle")
        log_event(_LOGGER, "release_promoted", {"version": version, "dev_session_id": dev.session_id})
        increment("releases_promoted")
        return version

    def get_status(self) -> dict[str, Any]:
        prod = self.get_production_session()
        dev = self.get_dev_session()
        return {
            "production": prod.to_json() if prod else None,
            "dev": dev.to_json() if dev else None,
            "releases": self._state.get("releases", []),
        }


def create_dev_env(root: Optional[str | Path] = None) -> DevEnvironment:
    return DevEnvironment(root=root)


def get_dev_env(root: Optional[str | Path] = None) -> DevEnvironment:
    return DevEnvironment(root=root)


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser(description="Glideloop dev environment runtime")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("status", help="Show production/dev session status")

    subparsers.add_parser("dev", help="Start/ensure dev CTO session")

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
        print("Dev CTO session started")
    elif args.command == "promote":
        version = env.promote_to_release(tag=args.tag)
        if version is None:
            print("Release promotion failed")
            raise SystemExit(1)
        print(f"Promoted {version}")


if __name__ == "__main__":
    main()
