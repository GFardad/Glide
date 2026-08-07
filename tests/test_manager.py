"""Tests for runtime manager package."""

from __future__ import annotations

import pytest

from runtime.manager.cto_manager import CTOManager, CTOManagerConfig
from runtime.manager.team_comms import TeamCommunication, TeamMessage, TeamStatus
from runtime.manager.metrics import MetricsDashboard, MetricSnapshot
from runtime.manager.decisions import DecisionEngine, Decision, DecisionOutcome
from runtime.manager.reports import ReportSystem, DailyReport, WeeklyReport


def test_cto_manager_register_and_check():
    manager = CTOManager()
    manager.register_team("core", {"version": "1.0"})
    status = manager.check_teams()
    assert "core" in status
    assert status["core"]["status"] == "registered"


def test_cto_manager_escalate():
    manager = CTOManager()
    manager.register_team("core", {"version": "1.0"})
    action = manager.escalate("core", "timeout")
    assert action["type"] == "escalation"
    assert action["team"] == "core"
    assert len(manager.get_action_log()) == 1


def test_team_comms_send_and_status():
    comms = TeamCommunication()
    msg = comms.send("cto", "core", "hello")
    assert msg.sender == "cto"
    assert msg.recipient == "core"
    assert comms.get_messages("core") == [msg]


def test_metrics_dashboard_collect():
    dashboard = MetricsDashboard()
    snapshot = dashboard.collect()
    assert isinstance(snapshot, MetricSnapshot)
    report = dashboard.report()
    assert "timestamp" in report
    assert "metrics" in report


def test_decision_engine_decide():
    engine = DecisionEngine()
    decision = engine.decide("promote", "promote candidate")
    assert decision.type == "promote"
    engine.record_outcome(decision.id, "success")
    assert engine.outcomes[decision.id].status == "success"


def test_report_system_generates():
    system = ReportSystem()
    daily = system.generate_daily({"teams_checked": 2, "issues_found": 1, "escalations": 0, "decisions_made": 1})
    assert isinstance(daily, DailyReport)
    assert daily.teams_checked == 2
