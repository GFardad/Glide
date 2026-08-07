"""Tests for runtime MCP server tool dispatch."""

from __future__ import annotations

import json

import pytest

from runtime.mcp.server import handle_tool


def test_handle_glideloop_status():
    payload = handle_tool("glideloop_status", {})
    assert json.loads(payload)["status"] == "ok"


def test_handle_glideloop_run():
    payload = handle_tool("glideloop_run", {"objective": "build auth", "mode": "hybrid"})
    assert "build auth" in payload


def test_handle_glideloop_todos_create():
    payload = handle_tool("glideloop_todos", {"action": "create", "content": "write tests"})
    assert "write tests" in payload


def test_handle_unknown_tool():
    payload = handle_tool("unknown_tool", {})
    assert "unknown tool" in payload
