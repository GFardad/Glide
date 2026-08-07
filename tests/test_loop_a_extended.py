"""Tests for Loop A artifact store edge cases."""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

from runtime.meta.loop_a import ArtifactMeta, ArtifactStore, LoopAPromoter


def test_artifact_store_rejects_missing_candidate(tmp_path):
    store = ArtifactStore(root=str(tmp_path))
    meta = ArtifactMeta(artifact_id="x", version="v1", parent_version=None, created_at="2026-08-07T00:00:00+00:00", change_summary="x")
    result = LoopAPromoter(store=store).promote("strategies", "missing", "missing.py", meta)
    assert result["status"] == "fail"


def test_observer_handles_missing_workspace(tmp_path):
    missing = tmp_path / "missing"
    report = __import__("runtime.meta.loop_a", fromlist=["LoopAObserver"]).LoopAObserver(workspace=str(missing)).weekly_report()
    assert "timestamp" in report


def test_promote_creates_symlink_and_history(tmp_path):
    store = ArtifactStore(root=str(tmp_path))
    meta = ArtifactMeta(artifact_id="prompt-v2", version="v2", parent_version="v1", created_at="2026-08-07T00:00:00+00:00", change_summary="improved")
    store.write_candidate("prompts", "prompt-v2", "prompt-v2-draft.md", "v2", meta)
    promoted = __import__("runtime.meta.loop_a", fromlist=["LoopAPromoter"]).LoopAPromoter(store=store).promote("prompts", "prompt-v2", "prompt-v2-draft.md", meta)
    assert promoted["status"] == "promoted"
    current = store.current_symlink("prompts", "prompt-v2")
    assert current.exists()
    history_files = list((tmp_path / "history").glob("*.md"))
    assert len(history_files) == 1
