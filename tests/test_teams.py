"""Tests for runtime agents teams module."""

from __future__ import annotations

import pytest

from runtime.agents.teams import TEAM_ROSTER, TeamDefinition, select_team


def test_team_roster_size():
    assert len(TEAM_ROSTER()) == 12


def test_select_teams_by_keyword():
    teams = select_team("build an observability platform with sre and security review", max_teams=5)
    assert len(teams) == 5
    assert teams[0].team_id == "team-platform"


def test_select_teams_fills_when_insufficient_matches():
    teams = select_team("foobar unknown xyz", max_teams=3)
    assert len(teams) == 3
    assert all(isinstance(team, TeamDefinition) for team in teams)


def test_team_matches_activation():
    team = TeamDefinition("team-data", "Data", ("data-engineer",), 4, ("data", "ml"), 0)
    assert team.matches("train ml model") is True
    assert team.matches("write docs") is False


def test_team_always_matches_without_activation():
    team = TeamDefinition("team-generic", "Generic", (), 1, (), 0)
    assert team.matches("anything") is True
