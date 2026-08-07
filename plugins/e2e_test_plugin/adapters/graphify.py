"""Graphify adapter: call Graphify via MCP for project mapping."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def graphify_project(project_name: str) -> dict[str, Any]:
    project_root = _find_project_root(project_name)
    graph_path = project_root / "graphify-out" / "graph.json"
    if not graph_path.exists():
        return {
            "project_name": project_name,
            "project_root": str(project_root),
            "status": "skipped",
            "optional": True,
            "graph_stats": None,
            "detail": f"graph.json not found: {graph_path}",
        }

    try:
        data = json.loads(graph_path.read_text(encoding="utf-8"))
        return {
            "project_name": project_name,
            "project_root": str(project_root),
            "graph_stats": {
                "nodes": len(data.get("nodes", [])),
                "edges": len(data.get("edges", [])),
                "communities": len(data.get("communities", [])),
            },
            "status": "ok",
            "optional": True,
        }
    except Exception as exc:
        return {
            "project_name": project_name,
            "project_root": str(project_root),
            "status": "error",
            "optional": True,
            "detail": str(exc),
        }


def _find_project_root(project_name: str) -> Path:
    candidates = [
        Path.cwd() / project_name,
        Path.cwd().parent / project_name,
        Path.home() / "projects" / project_name,
        Path.home() / "Projects" / project_name,
        Path.home() / project_name,
    ]
    for candidate in candidates:
        if candidate.exists() and candidate.is_dir():
            return candidate
    raise FileNotFoundError(f"project root not found for {project_name}")
