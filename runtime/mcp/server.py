"""Glideloop MCP server — stdio tool surface for Hermes.

Uses the real `mcp` package if available; otherwise falls back
to a minimal JSON-RPC stdio server so the prototype remains runnable
without extra installs.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

TOOLS = [
    {
        "name": "glideloop_status",
        "description": "Return Glideloop runtime status and active sessions.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "glideloop_run",
        "description": "Start a new Glideloop session for an objective.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "objective": {"type": "string"},
                "mode": {"type": "string", "enum": ["swarm", "subagent", "hybrid"], "default": "hybrid"},
                "depth": {"type": "integer", "minimum": 1, "maximum": 5, "default": 3},
                "target_agents": {"type": "integer", "minimum": 1, "maximum": 200, "default": 20},
            },
            "required": ["objective"],
        },
    },
    {
        "name": "glideloop_stop",
        "description": "Stop a running Glideloop session.",
        "inputSchema": {
            "type": "object",
            "properties": {"session_id": {"type": "string"}},
            "required": ["session_id"],
        },
    },
    {
        "name": "glideloop_todos",
        "description": "List or create todos in the current session.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": ["list", "create"], "default": "list"},
                "content": {"type": "string"},
                "priority": {"type": "integer", "minimum": 0, "maximum": 10, "default": 0},
            },
        },
    },
    {
        "name": "glideloop_meeting",
        "description": "Run a CTO meeting room for an objective and return Plan + Architecture + Todos.",
        "inputSchema": {
            "type": "object",
            "properties": {"objective": {"type": "string"}},
            "required": ["objective"],
        },
    },
    {
        "name": "glideloop_quality",
        "description": "Run quality gates for a session.",
        "inputSchema": {
            "type": "object",
            "properties": {"session_id": {"type": "string"}},
            "required": ["session_id"],
        },
    },
]


def _resolve_session_dir(session_id: str) -> str:
    base = os.environ.get("GLIDELOOP_WORKSPACE", "/tmp/glideloop-workspace")
    return os.path.join(base, session_id)


def _list_todos(session_id: str) -> dict[str, Any]:
    from runtime.glideloop_orchestrator.session import Session

    session = Session(
        session_id=session_id,
        objective="",
        mode="hybrid",
        depth=3,
        target_agents=20,
        status="running",
        cwd=_resolve_session_dir(session_id),
    )
    todos_path = Path(session.cwd) / "TODO.md"
    items = []
    if todos_path.exists():
        for line in todos_path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if stripped.startswith("- [ ] ") or stripped.startswith("- [x] "):
                items.append(stripped)
    return {"session_id": session_id, "todos": items}


def handle_tool(name: str, arguments: dict[str, Any]) -> str:
    from runtime.observability.counters import increment

    if name == "glideloop_status":
        increment("mcp_tool_calls")
        try:
            from runtime.observability.counters import get_counters

            counters = get_counters()
            return json.dumps(
                {
                    "status": "ok",
                    "orchestrator": {},
                    "sessions": [],
                    "counters": {
                        "sessions_started": counters.sessions_started,
                        "todos_created": counters.todos_created,
                        "todos_merged": counters.todos_merged,
                        "loop_b_hints_injected": counters.loop_b_hints_injected,
                        "loop_a_promotions": counters.loop_a_promotions,
                        "loop_a_rollbacks": counters.loop_a_rollbacks,
                    },
                },
                ensure_ascii=False,
            )
        except Exception as exc:
            return json.dumps({"status": "error", "detail": str(exc)}, ensure_ascii=False)

    if name == "glideloop_run":
        increment("mcp_tool_calls")
        from runtime.glideloop_orchestrator.main import main as orchestrator_main

        objective = arguments.get("objective", "demo")
        exit_code = orchestrator_main(["run", objective])
        if exit_code == 0:
            increment("sessions_started")
        return json.dumps({"exit_code": exit_code, "objective": objective}, ensure_ascii=False)

    if name == "glideloop_stop":
        increment("mcp_tool_calls")
        session_id = arguments.get("session_id")
        return json.dumps({"stopped": session_id}, ensure_ascii=False)

    if name == "glideloop_todos":
        increment("mcp_tool_calls")
        from pathlib import Path

        action = arguments.get("action", "list")
        session_id = arguments.get("session_id", "default")
        if action == "create":
            content = arguments.get("content", "")
            priority = arguments.get("priority", 0)
            session_dir = _resolve_session_dir(session_id)
            Path(session_dir).mkdir(parents=True, exist_ok=True)
            todo_path = Path(session_dir) / "TODO.md"
            line = f"- [ ] {content} (p{priority})\n"
            with todo_path.open("a", encoding="utf-8") as handle:
                handle.write(line)
            increment("todos_created")
            return json.dumps({"created": content, "session_id": session_id}, ensure_ascii=False)
        payload = _list_todos(session_id)
        return json.dumps(payload, ensure_ascii=False)

    if name == "glideloop_meeting":
        increment("mcp_tool_calls")
        objective = arguments.get("objective", "")
        return json.dumps(
            {
                "objective": objective,
                "plan": "Draft plan for " + objective,
                "architecture": "Draft architecture for " + objective,
                "todos": ["draft plan", "draft architecture"],
            },
            ensure_ascii=False,
        )

    if name == "glideloop_quality":
        increment("mcp_tool_calls")
        from runtime.quality.gates import accept_branch
        from pathlib import Path

        session_id = arguments.get("session_id", "default")
        session_dir = _resolve_session_dir(session_id)
        artifacts = []
        for name in ["GOAL.md", "TODO.md", "NOTES.md", "REJECTED.md"]:
            if (Path(session_dir) / name).exists():
                artifacts.append(name)
        output = "\n".join(artifacts)
        passed = accept_branch(output)
        return json.dumps({"session_id": session_id, "passed": passed, "artifacts": artifacts}, ensure_ascii=False)

    return json.dumps({"error": f"unknown tool: {name}"}, ensure_ascii=False)


def _stdio_fallback() -> None:
    while True:
        line = sys.stdin.readline()
        if not line:
            break
        line = line.strip()
        if not line:
            continue
        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            continue
        if payload.get("method") != "tools/call":
            continue
        params = payload.get("params", {})
        response = {
            "jsonrpc": "2.0",
            "id": payload.get("id"),
            "result": {
                "content": [{"type": "text", "text": handle_tool(params.get("name"), params.get("arguments", {}))}],
                "isError": False,
            },
        }
        sys.stdout.write(json.dumps(response, ensure_ascii=False) + "\n")
        sys.stdout.flush()


def main() -> None:
    try:
        from mcp.server.stdio import stdio_server  # type: ignore
        from mcp.server import Server  # type: ignore

        app = Server("glideloop")

        @app.list_tools()
        async def list_tools():
            return TOOLS

        @app.call_tool()
        async def call_tool(name: str, arguments: dict):
            text = handle_tool(name, arguments)
            return [{"type": "text", "text": text}]

        import asyncio

        asyncio.run(
            app.run(
                *stdio_server(),
                app.create_initialization_options(),
            )
        )
        return
    except Exception:
        _stdio_fallback()


if __name__ == "__main__":
    main()
