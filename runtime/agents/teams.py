"""Glideloop fixed 12-team roster with dynamic activation."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable, Optional

from runtime.logging import get_logger, log_event

__all__ = ["TeamDefinition", "TeamRoster", "select_team"]

_LOGGER = get_logger("glideloop.teams")

# Fixed roster per implementation-roadmap.md Phase 5.
# Activation rule is a simple keyword matcher; if missing, team is always eligible.
_TEAMS: list[TeamDefinition] = []


@dataclass(frozen=True)
class TeamDefinition:
    team_id: str
    name: str
    roles: tuple[str, ...]
    max_agents: int
    activation: tuple[str, ...] = ()
    priority: int = 0

    def matches(self, objective: str) -> bool:
        if not self.activation:
            return True
        text = objective.lower()
        return any(re.search(rf"\b{re.escape(keyword.lower())}\b", text) for keyword in self.activation)


def _load() -> None:
    global _TEAMS
    if _TEAMS:
        return
    _TEAMS = [
        TeamDefinition("team-platform", "Platform", ("platform-pm", "sre", "security-engineer"), 5, ("platform", "infra", "service", "api"), 10),
        TeamDefinition("team-product", "Product", ("product-manager", "platform-pm", "qa-lead"), 3, ("product", "ux", "feature", "requirement"), 9),
        TeamDefinition("team-frontend", "Frontend", ("frontend-engineer", "design-system-engineer", "qa-lead"), 5, ("frontend", "ui", "web", "client"), 8),
        TeamDefinition("team-backend", "Backend", ("backend-engineer", "api-architect", "data-engineer"), 5, ("backend", "api", "server", "service"), 8),
        TeamDefinition("team-data", "Data", ("data-engineer", "ml-engineer", "analytics-engineer"), 4, ("data", "ml", "analytics", "pipeline", "etl"), 7),
        TeamDefinition("team-infra", "Infrastructure", ("sre", "devops-engineer", "security-engineer"), 4, ("infra", "terraform", "kubernetes", "cloud"), 7),
        TeamDefinition("team-security", "Security", ("security-engineer", "sre", "compliance-engineer"), 3, ("security", "auth", "compliance", "vulnerability"), 6),
        TeamDefinition("team-qa", "Quality", ("qa-lead", "test-automation-engineer", "release-engineer"), 4, ("qa", "test", "quality", "regression"), 6),
        TeamDefinition("team-research", "Research", ("research-engineer", "ml-engineer", "meta-learning-researcher"), 3, ("research", "paper", "literature", "benchmark"), 5),
        TeamDefinition("team-architecture", "Architecture", ("architect", "api-architect", "technical-writer"), 3, ("architecture", "design", "adr", "schema"), 5),
        TeamDefinition("team-devops", "DevOps", ("devops-engineer", "sre", "release-engineer"), 3, ("devops", "ci", "deploy", "release"), 4),
        TeamDefinition("team-sre", "SRE", ("sre", "observability-engineer", "incident-engineer"), 3, ("sre", "observability", "incident", "reliability"), 4),
    ]
    _TEAMS.sort(key=lambda item: (-item.priority, item.team_id))


def TEAM_ROSTER() -> list[TeamDefinition]:
    _load()
    return list(_TEAMS)


def select_team(objective: str, max_teams: int = 10) -> list[TeamDefinition]:
    _load()
    matched = [team for team in _TEAMS if team.matches(objective)]
    selected = matched[:max_teams]
    if len(selected) < max_teams:
        for team in _TEAMS:
            if team not in selected:
                selected.append(team)
            if len(selected) >= max_teams:
                break
    selected = selected[:max_teams]
    log_event(_LOGGER, "team_selected", {"objective": objective, "team_ids": [team.team_id for team in selected]})
    return selected
