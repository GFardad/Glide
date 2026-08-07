"""Tests for runtime meta loop_a artifact store."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest

from runtime.meta.loop_a import ArtifactMeta, ArtifactStore, LoopAObserver, LoopAProposer, LoopAValidator, LoopAPromoter


def test_artifact_store_promotes_candidate(tmp_path):
    store = ArtifactStore(root=str(tmp_path))
    meta = ArtifactMeta(artifact_id="prompt-v1", version="v1", parent_version=None, created_at="2026-08-07T00:00:00+00:00", change_summary="initial")
    store.write_candidate("prompts", "prompt-v1", "prompt-v1-draft.md", "hello", meta)
    promoted = LoopAPromoter(store=store).promote("prompts", "prompt-v1", "prompt-v1-draft.md", meta)
    assert promoted["status"] == "promoted"
    current = store.current_symlink("prompts", "prompt-v1")
    assert current.exists() and current.is_symlink()


def test_validator_returns_report(tmp_path):
    store = ArtifactStore(root=str(tmp_path))
    meta = ArtifactMeta(artifact_id="x", version="v1", parent_version=None, created_at="2026-08-07T00:00:00+00:00", change_summary="x")
    candidate = store.write_candidate("strategies", "x", "x.py", "x=1", meta)
    report = LoopAValidator(store=store).validate(candidate, meta)
    assert "status" in report
    assert report["status"] == "pass"
