"""Observability middleware for MCP tool calls."""

from __future__ import annotations

import time
from typing import Any

from runtime.observability.counters import increment

__all__ = ["mcp_middleware"]


def mcp_middleware(tool_name: str, arguments: dict[str, Any], handler) -> str:
    increment("mcp_tool_calls")
    start = time.perf_counter()
    try:
        result = handler(tool_name, arguments)
        duration_ms = (time.perf_counter() - start) * 1000
        return result
    except Exception as exc:
        duration_ms = (time.perf_counter() - start) * 1000
        raise exc
