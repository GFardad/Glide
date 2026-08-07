"""CTO Manager for coordinating dev_env version teams."""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from runtime.dev_env import DevEnvironment, DevSession
from runtime.manager.decisions import DecisionEngine
from runtime.logging import get_logger, log_event
from runtime.observability.counters import increment

logger = get_logger("glideloop.manager")


@dataclass
class CTOManagerConfig:
    """Configuration for the CTO Manager."""

    name: str = "CTO Manager"
    check_interval: int = 60
    escalation_threshold: int = 3
    auto_escalate: bool = True
    root: Path = Path("/home/gfardad/projects/glideloop")
    state_file: Path = field(default_factory=lambda: Path("/tmp/glideloop-manager-state.json"))


class CTOManager:
    """Manages dev_env version teams and coordinates their work."""

    def __init__(self, config: CTOManagerConfig | None = None) -> None:
        self.config = config or CTOManagerConfig()
        self.teams: dict[str, dict[str, Any]] = {}
        self.actions: list[dict[str, Any]] = []
        self._last_check = 0.0
        self._dev_env = DevEnvironment(self.config.root)

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

    def start_dev_session(self, session_id: str | None = None) -> DevSession:
        """Start a dev session."""
        session = self._dev_env.create_dev_session(session_id or f"dev-{time.time_ns()}")
        log_event(logger, "dev_session_started", payload={"session_id": session.session_id})
        return session

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
        log_event(logger, "manager_escalation", payload=action)
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

    def status(self) -> dict[str, Any]:
        """Get overall manager status."""
        return {
            "teams": self.check_teams(),
            "actions": self.get_action_log(),
            "dev_env": self._dev_env.get_status(),
        }

    def propose_promotion(self, tag: str | None = None) -> dict[str, Any]:
        """Propose promoting dev branch to main."""
        decision = DecisionEngine().decide("promote", "Propose promoting dev branch to main")
        log_event(logger, "promotion_proposed", payload={"decision_id": decision.id, "tag": tag})
        return {
            "decision_id": decision.id,
            "status": "proposed",
            "tag": tag,
            "timestamp": time.time(),
        }

    def broadcast(self, message: str, team: str | None = None) -> dict[str, Any]:
        """Broadcast a message to all teams or a specific team."""
        targets = [team] if team else list(self.teams.keys())
        deliveries: list[dict[str, Any]] = []
        for target in targets:
            delivery = {
                "team": target,
                "message": message,
                "timestamp": time.time(),
                "status": "delivered",
            }
            deliveries.append(delivery)
            log_event(logger, "manager_broadcast", payload=delivery)
        return {"deliveries": deliveries, "count": len(deliveries)}

    def sync_team(self, team: str) -> dict[str, Any]:
        """Sync a team's status from dev_env."""
        if team not in self.teams:
            raise ValueError(f"Unknown team: {team}")
        team_data = self.teams[team]
        team_data["last_update"] = time.time()
        log_event(logger, "manager_team_synced", payload={"team": team, "status": team_data["status"]})
        return {
            "team": team,
            "status": team_data["status"],
            "failures": team_data["failures"],
            "synced_at": time.time(),
        }

    def merge_proposal(self, source: str, target: str, tag: str | None = None) -> dict[str, Any]:
        """Propose merging source branch into target branch."""
        decision = DecisionEngine().decide(
            "merge",
            f"Merge {source} into {target}",
        )
        proposal = {
            "decision_id": decision.id,
            "source": source,
            "target": target,
            "tag": tag,
            "status": "proposed",
            "timestamp": time.time(),
        }
        log_event(logger, "merge_proposed", payload=proposal)
        return proposal
