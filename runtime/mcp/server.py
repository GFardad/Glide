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
            "properties": {
                "session_id": {"type": "string"},
            },
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
        "name": "meeting_room",
        "description": "Run a personality-driven meeting room debate on an objective, moderated by CEO. Returns brief.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "objective": {"type": "string"},
                "roles": {"type": "array", "items": {"type": "string"}, "default": ["architect", "engineer", "security", "qa", "product"]},
            },
            "required": ["objective"],
        },
    },
    {
        "name": "glideloop_quality",
        "description": "Run quality gates for a session.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "session_id": {"type": "string"},
            },
            "required": ["session_id"],
        },
    },
    {
        "name": "ceo_execute",
        "description": "Execute a CEO command that talks to the CTO Manager.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "command": {"type": "string"},
                "payload": {"type": "object"},
            },
            "required": ["command"],
        },
    },
    {
        "name": "ceo_status",
        "description": "Get CEO/CTO Manager overall status.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "ceo_history",
        "description": "Get CEO command history.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "version_create",
        "description": "Create a new version manifest.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "version": {"type": "string"},
                "codename": {"type": "string"},
            },
            "required": ["version"],
        },
    },
    {
        "name": "version_activate",
        "description": "Activate a version for development.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "version": {"type": "string"},
            },
            "required": ["version"],
        },
    },
    {
        "name": "version_release",
        "description": "Mark a version as released.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "version": {"type": "string"},
            },
            "required": ["version"],
        },
    },
    {
        "name": "version_list",
        "description": "List all versions.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "loop_b_readiness",
        "description": "Return Loop B readiness status from lightweight component checks.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "workspace": {"type": "string"},
                "root": {"type": "string"},
            },
        },
    },
    {
        "name": "ceo_spec",
        "description": "Start a spec phase for an objective.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "objective": {"type": "string"},
                "session_id": {"type": "string"},
            },
            "required": ["objective"],
        },
    },
    {
        "name": "ceo_plan",
        "description": "Start a plan phase from a spec session.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "spec_session_id": {"type": "string"},
                "session_id": {"type": "string"},
            },
            "required": ["spec_session_id"],
        },
    },
    {
        "name": "ceo_build",
        "description": "Start a build phase from a plan session.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "plan_session_id": {"type": "string"},
                "session_id": {"type": "string"},
            },
            "required": ["plan_session_id"],
        },
    },
    {
        "name": "ceo_test",
        "description": "Start a test phase from a build session.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "build_session_id": {"type": "string"},
                "session_id": {"type": "string"},
            },
            "required": ["build_session_id"],
        },
    },
    {
        "name": "ceo_review",
        "description": "Start a review phase from a test session.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "test_session_id": {"type": "string"},
                "session_id": {"type": "string"},
            },
            "required": ["test_session_id"],
        },
    },
    {
        "name": "ceo_ship",
        "description": "Start a ship phase from a review session.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "review_session_id": {"type": "string"},
                "session_id": {"type": "string"},
            },
            "required": ["review_session_id"],
        },
    },
    {
        "name": "code_review_graph",
        "description": "Run code-review-graph commands: build, update, detect-changes, impact, query, flows, status, architecture.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "enum": ["build", "update", "detect-changes", "impact", "query", "flows", "flow", "status", "architecture", "watch", "dead-code", "refactor"]},
                "args": {"type": "array", "items": {"type": "string"}},
                "root": {"type": "string"},
            },
            "required": ["command"],
        },
    },
    {
        "name": "glideloop_schedule",
        "description": "Schedule a recurring GlideLoop objective.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "objective": {"type": "string"},
                "cron": {"type": "string"},
                "session_id": {"type": "string"},
            },
            "required": ["objective", "cron"],
        },
    },
    {
        "name": "worker_status",
        "description": "Return worker status from runtime/state/worker.json.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "root": {"type": "string"},
            },
        },
    },
]


def _resolve_session_dir(session_id: str) -> str:
    base = os.environ.get("GLIDELOOP_WORKSPACE", "/tmp/glideloop-workspace")
    return os.path.join(base, session_id)


_TOOL_SCHEMAS: dict[str, dict[str, Any]] = {tool["name"]: tool.get("inputSchema", {}) for tool in TOOLS}


def _validate_arguments(name: str, arguments: dict[str, Any]) -> dict[str, Any] | None:
    schema = _TOOL_SCHEMAS.get(name)
    if not schema:
        return None
    if not isinstance(arguments, dict):
        return {"status": "error", "detail": "arguments must be a JSON object"}
    required = schema.get("required", [])
    missing = [field for field in required if field not in arguments or arguments.get(field) in (None, "")]
    if missing:
        return {
            "status": "error",
            "detail": f"missing required fields: {', '.join(missing)}",
            "missing": missing,
        }
    properties = schema.get("properties", {})
    errors: list[str] = []
    for key, value in arguments.items():
        expected = properties.get(key)
        if not expected:
            continue
        if expected.get("type") == "string" and not isinstance(value, str):
            errors.append(f"{key} must be a string")
        elif expected.get("type") == "integer" and not isinstance(value, int):
            errors.append(f"{key} must be an integer")
        elif expected.get("type") == "array" and not isinstance(value, list):
            errors.append(f"{key} must be an array")
        elif expected.get("type") == "object" and not isinstance(value, dict):
            errors.append(f"{key} must be an object")
        if errors:
            return {
                "status": "error",
                "detail": "; ".join(errors),
                "validation_errors": errors,
            }
    return None


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

    validation_error = _validate_arguments(name, arguments if isinstance(arguments, dict) else {})
    if validation_error is not None:
        return json.dumps(validation_error, ensure_ascii=False)
    if not isinstance(arguments, dict):
        return json.dumps({"status": "error", "detail": "arguments must be a JSON object"}, ensure_ascii=False)
    encoded = json.dumps(arguments, ensure_ascii=False)
    if len(encoded) > 8192:
        return json.dumps({"status": "error", "detail": f"arguments too large: {len(encoded)} bytes, max 8192"}, ensure_ascii=False)

    try:
        from runtime.observability.middleware import mcp_middleware
        return mcp_middleware(name, arguments, _dispatch_tool)
    except Exception as exc:
        return json.dumps({"status": "error", "detail": str(exc)}, ensure_ascii=False)


from runtime.observability.counters import increment


def _dispatch_tool(name: str, arguments: dict[str, Any]) -> str:
    if name == "glideloop_status":
        increment("mcp_tool_calls")
        try:
            from runtime.observability.counters import get_counters
            from runtime.glideloop_orchestrator.state import OrchestratorState

            counters = get_counters()
            try:
                from runtime.ceo.ceo import CEO

                ceo_status = CEO().execute("status")
            except Exception:
                ceo_status = {}
            from pathlib import Path
            db_path = os.path.join(os.path.dirname(__file__), "..", "state", "glideloop_orchestrator.sqlite")
            state = OrchestratorState(db_path=Path(db_path))
            conn = state.connect()
            rows = conn.execute(
                "SELECT session_id, objective, status, cwd, created_at FROM sessions ORDER BY created_at DESC"
            ).fetchall()
            sessions = [
                {
                    "session_id": row["session_id"],
                    "objective": row["objective"],
                    "status": row["status"],
                    "cwd": row["cwd"],
                    "created_at": row["created_at"],
                }
                for row in rows
            ]
            orchestrator = {
                "session_count": len(sessions),
                "active_sessions": sum(1 for session in sessions if session["status"] == "running"),
            }
            return json.dumps(
                {
                    "status": "ok",
                    "orchestrator": orchestrator,
                    "sessions": sessions,
                    "counters": {
                        "sessions_started": counters.sessions_started,
                        "todos_created": counters.todos_created,
                        "todos_merged": counters.todos_merged,
                        "loop_b_hints_injected": counters.loop_b_hints_injected,
                        "loop_a_promotions": counters.loop_a_promotions,
                        "loop_a_rollbacks": counters.loop_a_rollbacks,
                        "mcp_tool_calls": counters.mcp_tool_calls,
                        "production_sessions_created": counters.production_sessions_created,
                        "dev_sessions_created": counters.dev_sessions_created,
                        "dev_approvals_started": counters.dev_approvals_started,
                        "dev_approvals_completed": counters.dev_approvals_completed,
                        "releases_promoted": counters.releases_promoted,
                        "manager_teams_registered": counters.manager_teams_registered,
                        "manager_escalations": counters.manager_escalations,
                        "manager_checks_run": counters.manager_checks_run,
                        "workspaces_created": counters.workspaces_created,
                        "sessions_processed_by_worker": _count_worker_processed(),
                    },
                    "teams": ceo_status.get("teams", {}),
                    "dev_env": ceo_status.get("dev_env", {}),
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

    if name == "meeting_room":
        increment("mcp_tool_calls")
        try:
            from runtime.meeting_room.meeting import MeetingRoom
            objective = arguments.get("objective", "")
            roles = arguments.get("roles", ["architect", "engineer", "security", "qa", "product"])
            room = MeetingRoom(objective=objective, roles=roles)
            brief = room.run()
            return json.dumps({"status": "ok", **brief.__dict__}, ensure_ascii=False)
        except Exception as exc:
            return json.dumps({"status": "error", "detail": str(exc)}, ensure_ascii=False)

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

    if name == "ceo_execute":
        increment("mcp_tool_calls")
        command = arguments.get("command")
        payload = arguments.get("payload") or {}
        if not command:
            return json.dumps({"status": "error", "detail": "command required"}, ensure_ascii=False)
        try:
            from runtime.ceo.ceo import CEO
            from runtime.events import emit

            ceo = CEO()
            result = ceo.execute(command, payload)
            emit("ceo_command_completed", result)
            return json.dumps(result, ensure_ascii=False)
        except Exception as exc:
            return json.dumps({"status": "error", "detail": str(exc)}, ensure_ascii=False)

    if name == "ceo_status":
        increment("mcp_tool_calls")
        try:
            from runtime.ceo.ceo import CEO

            ceo = CEO()
            result = ceo.execute("status")
            return json.dumps(result, ensure_ascii=False)
        except Exception as exc:
            return json.dumps({"status": "error", "detail": str(exc)}, ensure_ascii=False)

    if name == "ceo_history":
        increment("mcp_tool_calls")
        try:
            from runtime.ceo.ceo import CEO

            ceo = CEO()
            return json.dumps({"status": "ok", "history": ceo.history()}, ensure_ascii=False)
        except Exception as exc:
            return json.dumps({"status": "error", "detail": str(exc)}, ensure_ascii=False)

    if name == "version_create":
        increment("mcp_tool_calls")
        try:
            from runtime.versioning.versioning import VersionLifecycle
            from pathlib import Path

            root = Path(os.environ.get("GLIDELOOP_ROOT", "/home/gfardad/projects/glideloop"))
            version = arguments.get("version")
            codename = arguments.get("codename", "")
            if not version:
                return json.dumps({"status": "error", "detail": "version required"}, ensure_ascii=False)
            lifecycle = VersionLifecycle(root)
            manifest = lifecycle.create_version(version, codename=codename)
            return json.dumps({
                "status": "ok",
                "version": manifest.version,
                "codename": manifest.codename,
                "created_at": manifest.created_at,
            }, ensure_ascii=False)
        except Exception as exc:
            return json.dumps({"status": "error", "detail": str(exc)}, ensure_ascii=False)

    if name == "version_activate":
        increment("mcp_tool_calls")
        try:
            from runtime.versioning.versioning import VersionLifecycle
            from pathlib import Path

            root = Path(os.environ.get("GLIDELOOP_ROOT", "/home/gfardad/projects/glideloop"))
            version = arguments.get("version")
            if not version:
                return json.dumps({"status": "error", "detail": "version required"}, ensure_ascii=False)
            lifecycle = VersionLifecycle(root)
            manifest = lifecycle.activate_version(version)
            return json.dumps({
                "status": "ok",
                "version": manifest.version,
                "status": manifest.status,
            }, ensure_ascii=False)
        except Exception as exc:
            return json.dumps({"status": "error", "detail": str(exc)}, ensure_ascii=False)

    if name == "version_release":
        increment("mcp_tool_calls")
        try:
            from runtime.versioning.versioning import VersionLifecycle
            from pathlib import Path

            root = Path(os.environ.get("GLIDELOOP_ROOT", "/home/gfardad/projects/glideloop"))
            version = arguments.get("version")
            if not version:
                return json.dumps({"status": "error", "detail": "version required"}, ensure_ascii=False)
            lifecycle = VersionLifecycle(root)
            manifest = lifecycle.release_version(version)
            return json.dumps({
                "status": "ok",
                "version": manifest.version,
                "status": manifest.status,
                "released_at": manifest.released_at,
            }, ensure_ascii=False)
        except Exception as exc:
            return json.dumps({"status": "error", "detail": str(exc)}, ensure_ascii=False)

    if name == "version_list":
        increment("mcp_tool_calls")
        try:
            from runtime.versioning.versioning import VersionLifecycle
            from pathlib import Path

            root = Path(os.environ.get("GLIDELOOP_ROOT", "/home/gfardad/projects/glideloop"))
            lifecycle = VersionLifecycle(root)
            versions = lifecycle.list_versions()
            return json.dumps({"status": "ok", "versions": versions}, ensure_ascii=False)
        except Exception as exc:
            return json.dumps({"status": "error", "detail": str(exc)}, ensure_ascii=False)

    if name == "loop_b_readiness":
        increment("mcp_tool_calls")
        try:
            from runtime.meta.loop_b.readiness import readiness

            probe = readiness(
                workspace=arguments.get("workspace"),
                root=arguments.get("root"),
            )
            return json.dumps(
                {
                    "status": "ok",
                    "ready": probe.monitor and probe.intervention and probe.learning,
                    "monitor": probe.monitor,
                    "intervention": probe.intervention,
                    "learning": probe.learning,
                    "details": probe.details,
                },
                ensure_ascii=False,
            )
        except Exception as exc:
            return json.dumps({"status": "error", "detail": str(exc)}, ensure_ascii=False)

    if name == "ceo_spec":
        increment("mcp_tool_calls")
        try:
            from runtime.ceo.ceo import CEO

            ceo = CEO()
            result = ceo.execute("spec", arguments)
            return json.dumps(result, ensure_ascii=False)
        except Exception as exc:
            return json.dumps({"status": "error", "detail": str(exc)}, ensure_ascii=False)

    if name == "ceo_plan":
        increment("mcp_tool_calls")
        try:
            from runtime.ceo.ceo import CEO

            ceo = CEO()
            result = ceo.execute("plan", arguments)
            return json.dumps(result, ensure_ascii=False)
        except Exception as exc:
            return json.dumps({"status": "error", "detail": str(exc)}, ensure_ascii=False)

    if name == "ceo_build":
        increment("mcp_tool_calls")
        try:
            from runtime.ceo.ceo import CEO

            ceo = CEO()
            result = ceo.execute("build", arguments)
            return json.dumps(result, ensure_ascii=False)
        except Exception as exc:
            return json.dumps({"status": "error", "detail": str(exc)}, ensure_ascii=False)

    if name == "ceo_test":
        increment("mcp_tool_calls")
        try:
            from runtime.ceo.ceo import CEO

            ceo = CEO()
            result = ceo.execute("test", arguments)
            return json.dumps(result, ensure_ascii=False)
        except Exception as exc:
            return json.dumps({"status": "error", "detail": str(exc)}, ensure_ascii=False)

    if name == "ceo_review":
        increment("mcp_tool_calls")
        try:
            from runtime.ceo.ceo import CEO

            ceo = CEO()
            result = ceo.execute("review", arguments)
            return json.dumps(result, ensure_ascii=False)
        except Exception as exc:
            return json.dumps({"status": "error", "detail": str(exc)}, ensure_ascii=False)

    if name == "ceo_ship":
        increment("mcp_tool_calls")
        try:
            from runtime.ceo.ceo import CEO

            ceo = CEO()
            result = ceo.execute("ship", arguments)
            return json.dumps(result, ensure_ascii=False)
        except Exception as exc:
            return json.dumps({"status": "error", "detail": str(exc)}, ensure_ascii=False)

    if name == "code_review_graph":
        increment("mcp_tool_calls")
        try:
            import shutil
            import subprocess
            from pathlib import Path

            command = arguments.get("command", "status")
            args = arguments.get("args", [])
            root = Path(arguments.get("root") or os.environ.get("GLIDELOOP_ROOT", "/home/gfardad/projects/glideloop"))
            binary = shutil.which("code-review-graph")
            if not binary:
                return json.dumps({"status": "error", "detail": "code-review-graph not found in PATH"}, ensure_ascii=False)
            cmd = [binary, command, *args]
            result = subprocess.run(cmd, cwd=str(root), capture_output=True, text=True, timeout=600)
            payload = {"status": "ok" if result.returncode == 0 else "error", "stdout": result.stdout, "stderr": result.stderr, "returncode": result.returncode}
            return json.dumps(payload, ensure_ascii=False)
        except Exception as exc:
            return json.dumps({"status": "error", "detail": str(exc)}, ensure_ascii=False)

    if name == "glideloop_schedule":
        increment("mcp_tool_calls")
        try:
            from runtime.ceo.ceo import CEO

            ceo = CEO()
            result = ceo.execute("schedule", arguments)
            return json.dumps(result, ensure_ascii=False)
        except Exception as exc:
            return json.dumps({"status": "error", "detail": str(exc)}, ensure_ascii=False)

    if name == "worker_status":
        increment("mcp_tool_calls")
        try:
            from pathlib import Path
            import json as _json

            root = Path(arguments.get("root") or "/home/gfardad/projects/glideloop")
            status_path = root / "runtime" / "state" / "worker.json"
            if not status_path.exists():
                return json.dumps({"status": "error", "detail": "worker.json not found"}, ensure_ascii=False)
            data = _json.loads(status_path.read_text(encoding="utf-8"))
            return json.dumps({"status": "ok", "worker": data}, ensure_ascii=False)
        except Exception as exc:
            return json.dumps({"status": "error", "detail": str(exc)}, ensure_ascii=False)

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
        async def list_tools() -> list[dict[str, Any]]:
            return TOOLS

        @app.call_tool()
        async def call_tool(name: str, arguments: dict) -> list[dict[str, Any]]:
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
