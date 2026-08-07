"""CTO Manager for coordinating dev_env version teams."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from runtime.observability.counters import increment
from runtime.logging import log_event

logger = logging.getLogger(__name__)


@dataclass
class CTOManagerConfig:
    """Configuration for the CTO Manager."""

    name: str = "CTO Manager"
    check_interval: int = 60
    escalation_threshold: int = 3
    auto_escalate: bool = True
    root: Path = Path("/home/gfardad/projects/glideloop")


class CTOManager:
    """Manages dev_env version teams and coordinates their work."""

    def __init__(self, config: CTOManagerConfig | None = None) -> None:
        self.config = config or CTOManagerConfig()
        self.teams: dict[str, dict[str, Any]] = {}
        self.actions: list[dict[str, Any]] = []
        self._last_check = 0.0

    def register_team(self, name: str, config: dict[str, Any]) -> None:
        """Register a team for management."""
        self.teams[name] = {
            "config": config,
            "status": "registered",
            "last_status": "registered",
            "last_update": time.time(),
            "failures": 0,
        }
        increment("manager_teams_registered")
        log_event(logger, "manager_team_registered", payload={"name": name, "config": config})
        logger.info("Registered team: %s", name)

    def check_teams(self) -> dict[str, Any]:
        """Check all registered teams and report status."""
        increment("manager_checks_run")
        self._last_check = time.time()
        statuses: dict[str, Any] = {}

        for name, team in self.teams.items():
            statuses[name] = {
                "status": team["status"],
                "last_update": team["last_update"],
                "failures": team["failures"],
            }

        return statuses

    def escalate(self, team: str, reason: str) -> dict[str, Any]:
        """Escalate a team issue to the next level."""
        increment("manager_escalations")
        action = {
            "type": "escalation",
            "team": team,
            "reason": reason,
            "timestamp": time.time(),
        }
        self.actions.append(action)
        logger.warning("Escalated team %s: %s", team, reason)
        return action

    def update_team_status(self, team: str, status: str) -> None:
        """Update a team's status."""
        if team not in self.teams:
            raise ValueError(f"Unknown team: {team}")

        team_data = self.teams[team]
        team_data["last_status"] = team_data["status"]
        team_data["status"] = status
        team_data["last_update"] = time.time()

        if status == "failed":
            team_data["failures"] += 1

        logger.debug("Updated team %s: %s", team, status)

    def get_action_log(self) -> list[dict[str, Any]]:
        """Get the action log."""
        return list(self.actions)
