"""Tests for runtime agents runner module."""

from __future__ import annotations

import os
import subprocess

import pytest

from runtime.agents.runner import AgentContext, AgentRunner, SubagentContext, SubagentSpawner


def test_runner_echo_command(tmp_path):
    cwd = tmp_path / "agent"
    ctx = AgentContext(session_id="s1", agent_id="a1", team_id="team-platform", role="sre", cwd=cwd)
    runner = AgentRunner(env_allowlist=["HOME", "PATH", "USER"])
    result = runner.run(ctx, "echo hello")
    assert result.returncode == 0
    assert result.stdout.strip() == "hello"


def test_subagent_spawn_writes_goal(tmp_path):
    cwd = tmp_path / "parent"
    parent = AgentContext(session_id="s1", agent_id="a1", team_id="team-platform", role="sre", cwd=cwd)
    parent.ensure_contract()
    sub = SubagentContext(parent=parent, subagent_id="sub1", role="platform-pm", objective="draft plan")
    spawner = SubagentSpawner(AgentRunner())
    result = spawner.spawn(sub, "pwd")
    assert result.returncode == 0
    assert (sub.cwd / "GOAL.md").exists()
    assert "draft plan" in (sub.cwd / "GOAL.md").read_text(encoding="utf-8")


def test_append_note_writes_timestamped_entry(tmp_path):
    cwd = tmp_path / "agent"
    ctx = AgentContext(session_id="s1", agent_id="a1", team_id="team-platform", role="sre", cwd=cwd)
    ctx.ensure_contract()
    ctx.append_note("latency spike")
    note = (cwd / "NOTES.md").read_text(encoding="utf-8")
    assert "latency spike" in note


def test_runner_retry_budget_records_failure(tmp_path):
    cwd = tmp_path / "agent"
    ctx = AgentContext(session_id="s1", agent_id="a1", team_id="team-platform", role="sre", cwd=cwd)
    runner = AgentRunner(env_allowlist=[], retry_budget=1)
    result = runner.run(ctx, "false")
    assert result.returncode != 0
    note = (cwd / "NOTES.md").read_text(encoding="utf-8")
    assert "retry 1 failed" in note


def test_runner_loop_b_hint_appended_when_stuck(tmp_path):
    cwd = tmp_path / "agents" / "a1"
    ctx = AgentContext(session_id="s1", agent_id="a1", team_id="team-platform", role="sre", cwd=cwd)
    ctx.ensure_contract()
    (cwd / "NOTES.md").write_text("Error: boom\nError: boom\nError: boom\n", encoding="utf-8")
    runner = AgentRunner(env_allowlist=[], loop_b=True)
    result = runner.run(ctx, "echo after-stuck")
    assert result.returncode == 0
    note = (cwd / "NOTES.md").read_text(encoding="utf-8")
    assert "Loop B hint" in note
