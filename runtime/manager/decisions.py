"""Decision engine for CTO Manager."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class Decision:
    """A decision made by the CTO Manager."""

    id: str
    type: str
    description: str
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class DecisionOutcome:
    """Outcome of a decision."""

    decision_id: str
    status: str
    result: Any = None


class DecisionEngine:
    """Makes decisions about dev_env version teams."""

    def __init__(self) -> None:
        self.decisions: list[Decision] = []
        self.outcomes: dict[str, DecisionOutcome] = {}

    def decide(self, decision_type: str, description: str) -> Decision:
        """Make a decision."""
        decision = Decision(
            id=f"decision-{len(self.decisions) + 1}",
            type=decision_type,
            description=description,
        )
        self.decisions.append(decision)
        logger.info("Decision made: %s - %s", decision_type, description)
        return decision

    def record_outcome(self, decision_id: str, status: str, result: Any = None) -> None:
        """Record the outcome of a decision."""
        self.outcomes[decision_id] = DecisionOutcome(
            decision_id=decision_id,
            status=status,
            result=result,
        )
        logger.debug("Outcome recorded: %s -> %s", decision_id, status)
