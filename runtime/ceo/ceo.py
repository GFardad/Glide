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

    def execute(self, command: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        payload = payload or {}
        log_event(logger, "ceo_command_received", {"command": command, "payload": payload})
        result: dict[str, Any] = {"command": command, "status": "unknown"}

        if command == "register_team":
            name = payload.get("name")
            config = payload.get("config", {})
            if not name:
                result = {"command": command, "status": "error", "detail": "name required"}
            else:
                self.cto.register_team(name, config)
                result = {"command": command, "status": "ok", "team": name}

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

        elif command == "start_production_session":
            session_id = payload.get("session_id")
            session = self.cto.start_production_session(session_id)
            result = {
                "command": command,
                "status": "ok",
                "session_id": session.session_id,
                "role": session.role,
                "branch": session.branch,
                "workspace": str(session.workspace),
            }

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

        else:
            result = {"command": command, "status": "error", "detail": f"unknown command: {command}"}

        self._history.append(result)
        self._save_history()
        log_event(logger, "ceo_command_completed", result)
        return result

    def history(self) -> list[dict[str, Any]]:
        return list(self._history)
