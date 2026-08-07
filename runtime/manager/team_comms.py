"""Team communication for dev_env version teams."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class TeamMessage:
    """Message between teams."""

    sender: str
    recipient: str
    content: str
    priority: str = "normal"
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class TeamStatus:
    """Status of a team."""

    team: str
    status: str
    message: str = ""
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class TeamCommunication:
    """Handles communication between teams."""

    def __init__(self) -> None:
        self.messages: list[TeamMessage] = []
        self.statuses: dict[str, TeamStatus] = {}

    def send(self, sender: str, recipient: str, content: str, priority: str = "normal") -> TeamMessage:
        """Send a message to a team."""
        message = TeamMessage(
            sender=sender,
            recipient=recipient,
            content=content,
            priority=priority,
        )
        self.messages.append(message)
        logger.debug("Message sent: %s -> %s: %s", sender, recipient, content)
        return message

    def update_status(self, team: str, status: str, message: str = "") -> None:
        """Update a team's status."""
        team_status = TeamStatus(team=team, status=status, message=message)
        self.statuses[team] = team_status
        logger.debug("Status updated: %s -> %s", team, status)

    def get_messages(self, recipient: str | None = None) -> list[TeamMessage]:
        """Get messages, optionally filtered by recipient."""
        if recipient is None:
            return list(self.messages)
        return [msg for msg in self.messages if msg.recipient == recipient]

    def get_statuses(self) -> dict[str, TeamStatus]:
        """Get all team statuses."""
        return dict(self.statuses)
