"""Manager package for CTO and team coordination."""

from __future__ import annotations

__all__ = [
    "CTOManager",
    "CTOManagerConfig",
    "TeamCommunication",
    "TeamMessage",
    "TeamStatus",
    "MetricsDashboard",
    "MetricSnapshot",
    "DecisionEngine",
    "Decision",
    "DecisionOutcome",
    "ReportSystem",
    "DailyReport",
    "WeeklyReport",
]


def __getattr__(name: str):
    if name == "CTOManager":
        from runtime.manager.cto_manager import CTOManager
        return CTOManager
    if name == "CTOManagerConfig":
        from runtime.manager.cto_manager import CTOManagerConfig
        return CTOManagerConfig
    if name == "TeamCommunication":
        from runtime.manager.team_comms import TeamCommunication
        return TeamCommunication
    if name == "TeamMessage":
        from runtime.manager.team_comms import TeamMessage
        return TeamMessage
    if name == "TeamStatus":
        from runtime.manager.team_comms import TeamStatus
        return TeamStatus
    if name == "MetricsDashboard":
        from runtime.manager.metrics import MetricsDashboard
        return MetricsDashboard
    if name == "MetricSnapshot":
        from runtime.manager.metrics import MetricSnapshot
        return MetricSnapshot
    if name == "DecisionEngine":
        from runtime.manager.decisions import DecisionEngine
        return DecisionEngine
    if name == "Decision":
        from runtime.manager.decisions import Decision
        return Decision
    if name == "DecisionOutcome":
        from runtime.manager.decisions import DecisionOutcome
        return DecisionOutcome
    if name == "ReportSystem":
        from runtime.manager.reports import ReportSystem
        return ReportSystem
    if name == "DailyReport":
        from runtime.manager.reports import DailyReport
        return DailyReport
    if name == "WeeklyReport":
        from runtime.manager.reports import WeeklyReport
        return WeeklyReport
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
