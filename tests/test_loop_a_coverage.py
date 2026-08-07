"""Additional Loop A coverage for missed branches."""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

import pytest

from runtime.meta.loop_a import (
    ArtifactMeta,
    ArtifactStore,
    LoopAObserver,
    LoopAProposer,
    LoopAValidator,
    LoopAPromoter,
)


def test_reject_moves_candidate(tmp_path):
    store = ArtifactStore(root=str(tmp_path))
    meta = ArtifactMeta(artifact_id="x", version="v1", parent_version=None, created_at="2026-08-07T00:00:00+00:00", change_summary="x")
    store.write_candidate("prompts", "x", "x.md", "hello", meta)
    store.reject("prompts", "x.md", "bad")
    assert not (tmp_path / "candidates" / "prompts" / "x.md").exists()
    assert (tmp_path / "rejected" / "prompts" / "x.md").exists()


def test_log_event_writes_jsonl(tmp_path):
    store = ArtifactStore(root=str(tmp_path))
    store.log_event("test_event", {"key": "value"})
    log_file = tmp_path / "history" / "events.jsonl"
    assert log_file.exists()
    lines = [line for line in log_file.read_text(encoding="utf-8").splitlines() if line.strip()]
    assert len(lines) == 1
    payload = json.loads(lines[0])
    assert payload["event_type"] == "test_event"
    assert payload["key"] == "value"


def test_observer_reports_failure_signals(tmp_path):
    root = tmp_path / "workspace"
    (root / "skills" / "glideloop-cto" / "roles").mkdir(parents=True)
    (root / "skills" / "glideloop-cto" / "roles" / "bad.md").write_text("FIXME: fix me", encoding="utf-8")
    observer = LoopAObserver(workspace=str(root), store=ArtifactStore(root=str(tmp_path / "store")))
    report = observer.weekly_report()
    assert report["artifacts_scanned"] >= 1
    assert len(report["failure_signals"]) >= 1
    assert report["failure_signals"][0]["signal"] == "incomplete_artifact"


def test_proposer_creates_candidate(tmp_path):
    (tmp_path / "runtime" / "agents").mkdir(parents=True)
    (tmp_path / "runtime" / "agents" / "teams.py").write_text("teams = []", encoding="utf-8")
    store = ArtifactStore(root=str(tmp_path))
    proposer = LoopAProposer(workspace=str(tmp_path), store=store)
    candidates = proposer.propose_team_activation_candidates()
    assert len(candidates) == 1
    assert candidates[0]["artifact_id"] == "team-activation"
    assert (store.root / "candidates" / "strategies" / "teams-activation-refresh.py").exists()


def test_validator_fails_on_missing(tmp_path):
    store = ArtifactStore(root=str(tmp_path))
    validator = LoopAValidator(store=store)
    report = validator.validate(tmp_path / "missing.md", ArtifactMeta(artifact_id="x", version="v1", parent_version=None, created_at="2026-08-07T00:00:00+00:00", change_summary="x"))
    assert report["status"] == "fail"
    assert report["reason"] == "missing_candidate"


def test_promoter_rollback(tmp_path):
    store = ArtifactStore(root=str(tmp_path))
    meta = ArtifactMeta(artifact_id="prompt-v1", version="v1", parent_version=None, created_at="2026-08-07T00:00:00+00:00", change_summary="initial")
    store.write_candidate("prompts", "prompt-v1", "prompt-v1-draft.md", "hello", meta)
    LoopAPromoter(store=store).promote("prompts", "prompt-v1", "prompt-v1-draft.md", meta)
    result = LoopAPromoter(store=store).rollback("prompts", "prompt-v1", "testing")
    assert result["status"] == "rolled_back"
    current = store.current_symlink("prompts", "prompt-v1")
    assert current.exists() and current.is_symlink()
    assert current.readlink().name == "prompt-v1-v1.md"
