"""Glideloop CEO runtime with persistent state and event emission."""

from __future__ import annotations

import logging
import os
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from runtime.manager.cto_manager import CTOManager, CTOManagerConfig
from runtime.logging import get_logger, log_event
from runtime.state import StateStore

logger = get_logger("glideloop.ceo")

@dataclass
class CEOConfig:
    name: str = "Glideloop CEO"
    root: Path = Path("/home/gfardad/projects/glideloop")
    state_file: str = "/tmp/glideloop-ceo-state.json"
    state_dir: Optional[Path] = None

class CEO:
    def __init__(self, config: CEOConfig | None = None) -> None:
        self.config = config or CEOConfig()
        self.cto = CTOManager(CTOManagerConfig(root=self.config.root))
        self._history: list[dict[str, Any]] = []
        state_dir = self.config.state_dir
        if state_dir is None:
            state_dir = Path(os.environ.get("GLIDELOOP_STATE", "/tmp/glideloop-state"))
        self._store = StateStore(state_dir)
        self._load_history()

    def _load_history(self) -> None:
        stored = self._store.get("ceo", "history")
        if stored:
            self._history = stored.get("history", [])

    def _save_history(self) -> None:
        self._store.set("ceo", "history", {"history": self._history}, ttl_seconds=3600)

    def _record_action(self, action_type: str, payload: dict[str, Any]) -> dict[str, Any]:
        action = {"type": action_type, "timestamp": __import__('time').time(), **payload}
        self.cto.actions.append(action)
        log_event(logger, "ceo_action_recorded", action)
        return action

    def execute(self, command: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        payload = payload or {}
        log_event(logger, "ceo_command_received", {"command": command, "payload": payload})
        result: dict[str, Any] = {"command": command, "status": "unknown"}

        if command in ("start_production_session", "approve_dev", "promote_to_release", "link_sessions"):
            result = {
                "command": command,
                "status": "error",
                "detail": "User must not access production/dev control paths directly. All requests route through CEO.",
            }
            self._history.append(result)
            self._save_history()
            log_event(logger, "ceo_command_rejected", result)
            return result

        if command == "register_team":
            name = payload.get("name")
            config = payload.get("config", {})
            if not name:
                result = {"command": command, "status": "error", "detail": "name required"}
            else:
                self.cto.register_team(name, config)
                result = {"command": command, "status": "ok", "team": name}
                self._record_action("team_registered", {"team": name, "config": config})

        elif command == "check_teams":
            statuses = self.cto.check_teams()
            result = {"command": command, "status": "ok", "teams": statuses}

        elif command == "broadcast":
            message = payload.get("message", "")
            team = payload.get("team")
            outcome = self.cto.broadcast(message, team=team)
            result = {"command": command, "status": "ok", **outcome}

        elif command == "sync_team":
            team = payload.get("team")
            if not team:
                result = {"command": command, "status": "error", "detail": "team required"}
            else:
                outcome = self.cto.sync_team(team)
                result = {"command": command, "status": "ok", **outcome}

        elif command == "merge_proposal":
            source = payload.get("source")
            target = payload.get("target", "main")
            tag = payload.get("tag")
            if not source:
                result = {"command": command, "status": "error", "detail": "source required"}
            else:
                outcome = self.cto.merge_proposal(source, target, tag=tag)
                result = {"command": command, "status": "ok", **outcome}

        elif command == "propose_promotion":
            tag = payload.get("tag")
            outcome = self.cto.propose_promotion(tag=tag)
            result = {"command": command, "status": "ok", **outcome}

        elif command == "start_dev_session":
            session_id = payload.get("session_id")
            session = self.cto.start_dev_session(session_id)
            result = {
                "command": command,
                "status": "ok",
                "session_id": session.session_id,
                "role": session.role,
                "branch": session.branch,
                "workspace": str(session.workspace),
            }
            self._record_action("dev_session_started", result)

        elif command == "status":
            status = self.cto.status()
            result = {"command": command, "status": "ok", **status}

        elif command == "escalate":
            team = payload.get("team")
            reason = payload.get("reason", "")
            if not team:
                result = {"command": command, "status": "error", "detail": "team required"}
            else:
                action = self.cto.escalate(team, reason)
                result = {"command": command, "status": "ok", **action}

        elif command == "spec":
            objective = payload.get("objective", "")
            if not objective:
                result = {"command": command, "status": "error", "detail": "objective required"}
            else:
                session_id = payload.get("session_id") or f"spec-{uuid.uuid4().hex[:8]}"
                session = self.cto.start_dev_session(session_id)
                result = {
                    "command": command,
                    "status": "ok",
                    "phase": "spec",
                    "session_id": session.session_id,
                    "objective": objective,
                    "workspace": str(session.workspace),
                }
                self._record_action("phase_spec", result)

        elif command == "plan":
            spec_session_id = payload.get("spec_session_id") or payload.get("session_id")
            if not spec_session_id:
                result = {"command": command, "status": "error", "detail": "spec_session_id required"}
            else:
                session_id = f"plan-{uuid.uuid4().hex[:8]}"
                session = self.cto.start_dev_session(session_id)
                result = {
                    "command": command,
                    "status": "ok",
                    "phase": "plan",
                    "session_id": session.session_id,
                    "spec_session_id": spec_session_id,
                    "workspace": str(session.workspace),
                }
                self._record_action("phase_plan", result)

        elif command == "build":
            plan_session_id = payload.get("plan_session_id") or payload.get("session_id")
            if not plan_session_id:
                result = {"command": command, "status": "error", "detail": "plan_session_id required"}
            else:
                session_id = f"build-{uuid.uuid4().hex[:8]}"
                session = self.cto.start_dev_session(session_id)
                result = {
                    "command": command,
                    "status": "ok",
                    "phase": "build",
                    "session_id": session.session_id,
                    "plan_session_id": plan_session_id,
                    "workspace": str(session.workspace),
                }
                self._record_action("phase_build", result)

        elif command == "test":
            build_session_id = payload.get("build_session_id") or payload.get("session_id")
            if not build_session_id:
                result = {"command": command, "status": "error", "detail": "build_session_id required"}
            else:
                session_id = f"test-{uuid.uuid4().hex[:8]}"
                session = self.cto.start_dev_session(session_id)
                result = {
                    "command": command,
                    "status": "ok",
                    "phase": "test",
                    "session_id": session.session_id,
                    "build_session_id": build_session_id,
                    "workspace": str(session.workspace),
                }
                self._record_action("phase_test", result)

        elif command == "review":
            test_session_id = payload.get("test_session_id") or payload.get("session_id")
            if not test_session_id:
                result = {"command": command, "status": "error", "detail": "test_session_id required"}
            else:
                session_id = f"review-{uuid.uuid4().hex[:8]}"
                session = self.cto.start_dev_session(session_id)
                result = {
                    "command": command,
                    "status": "ok",
                    "phase": "review",
                    "session_id": session.session_id,
                    "test_session_id": test_session_id,
                    "workspace": str(session.workspace),
                }
                self._record_action("phase_review", result)

        elif command == "ship":
            review_session_id = payload.get("review_session_id") or payload.get("session_id")
            if not review_session_id:
                result = {"command": command, "status": "error", "detail": "review_session_id required"}
            else:
                session_id = f"ship-{uuid.uuid4().hex[:8]}"
                session = self.cto.start_dev_session(session_id)
                result = {
                    "command": command,
                    "status": "ok",
                    "phase": "ship",
                    "session_id": session.session_id,
                    "review_session_id": review_session_id,
                    "workspace": str(session.workspace),
                }
                self._record_action("phase_ship", result)

        else:
            result = {"command": command, "status": "error", "detail": f"unknown command: {command}"}

        self._history.append(result)
        self._save_history()
        log_event(logger, "ceo_command_completed", result)
        return result

    def history(self) -> list[dict[str, Any]]:
        return list(self._history)
