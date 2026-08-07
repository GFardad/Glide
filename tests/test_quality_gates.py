"""Tests for runtime quality gates."""

from __future__ import annotations

import pytest

from runtime.quality.gates import accept_branch, AcceptanceGate


def test_accept_branch_rejects_whitespace_only():
    assert accept_branch("   \n\t  ") is False


def test_accept_branch_rejects_missing_artifact():
    assert accept_branch("GOAL.md\nTODO.md") is False


def test_accept_branch_accepts_all_artifacts():
    output = "\n".join(["GOAL.md", "TODO.md", "NOTES.md", "REJECTED.md"])
    assert accept_branch(output) is True


def test_accept_branch_default_gate_cannot_be_bypassed():
    assert accept_branch("") is False
    assert accept_branch("GOAL.md\nTODO.md\nNOTES.md\nREJECTED.md") is True
