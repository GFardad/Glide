"""Tests for Loop B readiness probe."""

from __future__ import annotations

import pytest

from runtime.meta.loop_b.readiness import readiness


def test_readiness_returns_ok_for_valid_components():
    probe = readiness()
    assert probe.monitor is True
    assert probe.intervention is True
    assert probe.learning is True
    assert probe.details == {"monitor": "ok", "intervention": "ok", "learning": "ok"}
