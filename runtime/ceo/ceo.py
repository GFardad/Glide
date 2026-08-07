"""CEO runtime: user-facing orchestrator that talks to the CTO Manager."""

from __future__ import annotations

import json
import logging
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from runtime.manager.cto_manager import CTOManager, CTOManagerConfig
from runtime.logging import get_logger, log_event

logger = get_logger("glideloop.ceo")


@dataclass
class CEOConfig:
    """Configuration for the CEO runtime."""

    name: str = "Glideloop CEO"
    root: Path = Path("/home/gfardad/projects/glideloop")
    state_file: str = "/tmp/glideloop-ceo-state.json"


class CEO:
    """Top-level orchestrator that talks to the CTO Manager on behalf of the user."""

    def __init__(self, config: CEOConfig | None = None) -> None:
        self.config = config or CEOConfig()
        self.cto = CTOManager(CTOManagerConfig(root=self.config.root))
        self._history: list[dict[str, Any]] = []

    def execute(self, command: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        """Execute a high-level CEO command."""
        payload = payload or {}
        log_event(logger, "ceo_command_received", payload={"command": command, "payload": payload})
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
        log_event(logger, "ceo_command_completed", payload=result)
        return result

    def history(self) -> list[dict[str, Any]]:
        """Return executed command history."""
        return list(self._history)
