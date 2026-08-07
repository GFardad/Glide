"""End-to-end test for glideloop_run and related runtime surfaces."""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
import json
from pathlib import Path

import pytest

from runtime.agents.runner import AgentContext, AgentRunner
from runtime.logging import get_logger, log_event
from runtime.mcp.server import handle_tool
from runtime.meta.loop_a import ArtifactMeta, ArtifactStore, LoopAPromoter
from runtime.meta.loop_b import LoopBIntervention, LoopBMemory, LoopBMonitor
from runtime.observability.counters import get_counters, reset_counters
from runtime.quality.gates import ParallelBranchGate, ReviewResult
from runtime.registry.agent import TodoRegistryAgent


def test_e2e_glideloop_run_creates_session():
    with tempfile.TemporaryDirectory() as tmp:
        env = os.environ.copy()
        env["GLIDELOOP_ROOT"] = tmp
        script = (
            "import sys\n"
            "sys.path.insert(0, '/home/gfardad/projects/glideloop')\n"
            "from runtime.glideloop_orchestrator.main import main\n"
            "main(['run', 'demo-objective'])\n"
        )
        result = subprocess.run(
            [sys.executable, "-c", script],
            env=env,
            capture_output=True,
            text=True,
            check=True,
        )
        line = [line.strip() for line in result.stdout.strip().splitlines() if line.strip() and line.strip().startswith("started session=")][0]
        session_id, _, cwd_str = line[len("started session=") :].partition(" cwd=")
        cwd = Path(cwd_str)
        assert cwd.exists()
        assert (cwd / "GOAL.md").exists()
        assert "demo-objective" in (cwd / "GOAL.md").read_text(encoding="utf-8")


def test_e2e_session_runner_loop_b_integration():
    with tempfile.TemporaryDirectory() as tmp:
        cwd = Path(tmp) / "agents" / "a1"
        ctx = AgentContext(session_id="s1", agent_id="a1", team_id="team-platform", role="sre", cwd=cwd)
        ctx.ensure_contract()
        (cwd / "NOTES.md").write_text("Error: boom\nError: boom\nError: boom\n", encoding="utf-8")
        (cwd / "TODO.md").write_text("- [ ] task\n", encoding="utf-8")
        runner = AgentRunner(env_allowlist=[], loop_b=True)
        result = runner.run(ctx, "echo after-stuck")
        assert result.returncode == 0
        note = (cwd / "NOTES.md").read_text(encoding="utf-8")
        assert "Loop B hint" in note


def test_e2e_mcp_tool_increments_counters():
    reset_counters()
    handle_tool("glideloop_status", {})
    counters = get_counters()
    assert counters.mcp_tool_calls >= 1


def test_e2e_structured_logging_writes_jsonl(tmp_path):
    logger = get_logger("e2e", log_dir=str(tmp_path))
    log_event(logger, "e2e_event", {"check": "ok"})
    log_file = tmp_path / "glideloop.jsonl"
    assert log_file.exists()
    lines = [line for line in log_file.read_text(encoding="utf-8").splitlines() if line.strip()]
    assert len(lines) == 1
    payload = json.loads(lines[0])
    assert payload["message"] == "e2e_event"
    assert payload["payload"] == {"check": "ok"}


def test_e2e_quality_gate_accepts_within_threshold():
    gate = ParallelBranchGate(threshold=0.9)
    branches = [
        ReviewResult(branch_id="a", score=0.95, accepted=True, notes="good"),
        ReviewResult(branch_id="b", score=0.92, accepted=True, notes="good"),
    ]
    assert gate.accept(branches) is True


def test_e2e_loop_a_promote_creates_symlink(tmp_path):
    store = ArtifactStore(root=str(tmp_path))
    meta = ArtifactMeta(artifact_id="prompt-v1", version="v1", parent_version=None, created_at="2026-08-07T00:00:00+00:00", change_summary="initial")
    store.write_candidate("prompts", "prompt-v1", "prompt-v1-draft.md", "hello", meta)
    promoted = LoopAPromoter(store=store).promote("prompts", "prompt-v1", "prompt-v1-draft.md", meta)
    assert promoted["status"] == "promoted"
    current = store.current_symlink("prompts", "prompt-v1")
    assert current.exists() and current.is_symlink()


def test_e2e_loop_b_monitor_and_memory(tmp_path):
    root = tmp_path / "workspace"
    agent_dir = root / "agents" / "a1"
    agent_dir.mkdir(parents=True)
    (agent_dir / "NOTES.md").write_text("Error: boom\nError: boom\nError: boom\n", encoding="utf-8")
    (agent_dir / "TODO.md").write_text("- [ ] task\n", encoding="utf-8")
    monitor = LoopBMonitor(workspace=str(root))
    scan = monitor.scan("a1")
    assert scan.status == "flagged"
    intervention = LoopBIntervention(workspace=str(root))
    hint = intervention.maybe_hint("a1", scan=scan)
    assert hint is not None
    assert hint.hint.strip()
    memory = LoopBMemory(root=str(tmp_path / "memory"))
    path = memory.record({"session_id": "s1", "agent_id": "a1", "timestamp": "2026-08-07T00:00:00+00:00", "signal": "repetitive_failure", "strategy": "example_injection", "outcome": "success"})
    assert path.exists()
    patterns = memory.extract_patterns()
    assert isinstance(patterns, list)
