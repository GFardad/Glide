"""Report system for CTO Manager."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class DailyReport:
    """Daily report for the CTO Manager."""

    date: datetime
    teams_checked: int
    issues_found: int
    escalations: int
    decisions_made: int


@dataclass
class WeeklyReport:
    """Weekly report for the CTO Manager."""

    week_start: datetime
    week_end: datetime
    teams_checked: int
    issues_found: int
    escalations: int
    decisions_made: int
    summary: str = ""


class ReportSystem:
    """Generates reports for the CTO Manager."""

    def generate_daily(self, stats: dict[str, Any]) -> DailyReport:
        """Generate a daily report."""
        report = DailyReport(
            date=datetime.now(timezone.utc),
            teams_checked=stats.get("teams_checked", 0),
            issues_found=stats.get("issues_found", 0),
            escalations=stats.get("escalations", 0),
            decisions_made=stats.get("decisions_made", 0),
        )
        logger.info("Generated daily report: %s", report)
        return report

    def generate_weekly(self, stats: dict[str, Any], summary: str = "") -> WeeklyReport:
        """Generate a weekly report."""
        now = datetime.now(timezone.utc)
        report = WeeklyReport(
            week_start=now,
            week_end=now,
            teams_checked=stats.get("teams_checked", 0),
            issues_found=stats.get("issues_found", 0),
            escalations=stats.get("escalations", 0),
            decisions_made=stats.get("decisions_made", 0),
            summary=summary,
        )
        logger.info("Generated weekly report: %s", report)
        return report
