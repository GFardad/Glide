"""Tests for runtime observability middleware."""

from __future__ import annotations

import time
from unittest.mock import patch

import pytest

from runtime.observability.counters import get_counters, reset_counters
from runtime.observability.middleware import mcp_middleware


def test_middleware_increments_mcp_tool_calls():
    reset_counters()
    def fake_handler(tool_name: str, arguments: dict) -> str:
        return "ok"
    result = mcp_middleware("glideloop_status", {}, fake_handler)
    assert result == "ok"
    assert get_counters().mcp_tool_calls == 1


def test_middleware_propagates_handler_exception():
    reset_counters()
    def failing_handler(tool_name: str, arguments: dict) -> str:
        raise RuntimeError("boom")
    with pytest.raises(RuntimeError, match="boom"):
        mcp_middleware("glideloop_status", {}, failing_handler)
    assert get_counters().mcp_tool_calls == 1


def test_middleware_passes_arguments_through():
    reset_counters()
    def capturing_handler(tool_name: str, arguments: dict) -> str:
        return arguments.get("objective", "")
    result = mcp_middleware("meeting_room", {"objective": "ship MVP"}, capturing_handler)
    assert result == "ship MVP"
