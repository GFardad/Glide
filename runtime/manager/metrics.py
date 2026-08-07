"""Metrics dashboard for CTO Manager."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from runtime.observability.counters import get_counters

logger = logging.getLogger(__name__)


@dataclass
class MetricSnapshot:
    """Snapshot of metrics at a point in time."""

    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    data: dict[str, Any] = field(default_factory=dict)


class MetricsDashboard:
    """Collects and reports metrics for the CTO Manager."""

    def __init__(self) -> None:
        self.history: list[MetricSnapshot] = []

    def collect(self) -> MetricSnapshot:
        """Collect current metrics."""
        snapshot = MetricSnapshot()
        snapshot.data = {
            "counters": get_counters().__dict__,
        }
        self.history.append(snapshot)
        logger.debug("Collected metrics: %s", snapshot.data)
        return snapshot

    def report(self) -> dict[str, Any]:
        """Report current metrics."""
        snapshot = self.collect()
        return {
            "timestamp": snapshot.timestamp.isoformat(),
            "metrics": snapshot.data,
        }
