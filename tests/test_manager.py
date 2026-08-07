"""Tests for runtime manager package."""

from __future__ import annotations

from unittest.mock import patch

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


@patch("runtime.manager.cto_manager.DevEnvironment")
def test_cto_manager_start_dev_session(mock_dev_env_cls):
    mock_dev = mock_dev_env_cls.return_value
    mock_dev.create_dev_session.return_value.session_id = "dev-1"
    manager = CTOManager()
    session = manager.start_dev_session("dev-1")
    assert session.session_id == "dev-1"
    mock_dev.create_dev_session.assert_called_once_with("dev-1")


@patch("runtime.manager.cto_manager.DevEnvironment")
def test_cto_manager_status(mock_dev_env_cls):
    mock_dev = mock_dev_env_cls.return_value
    mock_dev.get_status.return_value = {"production": None, "dev": None, "releases": []}
    manager = CTOManager()
    manager.register_team("core", {"version": "1.0"})
    status = manager.status()
    assert "teams" in status
    assert "dev_env" in status
    assert status["dev_env"]["releases"] == []


@patch("runtime.manager.cto_manager.DecisionEngine")
def test_cto_manager_propose_promotion(mock_engine_cls):
    mock_engine = mock_engine_cls.return_value
    mock_decision = type("Decision", (), {"id": "decision-1"})()
    mock_engine.decide.return_value = mock_decision
    manager = CTOManager()
    result = manager.propose_promotion("release-1")
    assert result["status"] == "proposed"
    assert result["tag"] == "release-1"
    mock_engine.decide.assert_called_once_with("promote", "Propose promoting dev branch to main")


def test_cto_manager_broadcast_to_all():
    manager = CTOManager()
    manager.register_team("core", {"version": "1.0"})
    manager.register_team("ui", {"version": "1.0"})
    result = manager.broadcast("sync now")
    assert result["count"] == 2
    assert {delivery["team"] for delivery in result["deliveries"]} == {"core", "ui"}


def test_cto_manager_broadcast_to_team():
    manager = CTOManager()
    manager.register_team("core", {"version": "1.0"})
    result = manager.broadcast("sync core", team="core")
    assert result["count"] == 1
    assert result["deliveries"][0]["team"] == "core"


def test_cto_manager_sync_team():
    manager = CTOManager()
    manager.register_team("core", {"version": "1.0"})
    result = manager.sync_team("core")
    assert result["team"] == "core"
    assert result["status"] == "registered"
    assert "synced_at" in result


def test_cto_manager_sync_team_unknown():
    manager = CTOManager()
    with pytest.raises(ValueError):
        manager.sync_team("unknown")


@patch("runtime.manager.cto_manager.DecisionEngine")
def test_cto_manager_merge_proposal(mock_engine_cls):
    mock_engine = mock_engine_cls.return_value
    mock_decision = type("Decision", (), {"id": "decision-1"})()
    mock_engine.decide.return_value = mock_decision
    manager = CTOManager()
    result = manager.merge_proposal("feature/x", "main", tag="merge-1")
    assert result["source"] == "feature/x"
    assert result["target"] == "main"
    assert result["status"] == "proposed"
    mock_engine.decide.assert_called_once_with("merge", "Merge feature/x into main")
