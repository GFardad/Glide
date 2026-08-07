"""Graphify wrapper for plugin E2E test."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any


def graphify_project(project_name: str) -> dict[str, Any]:
    project_root = _find_project_root(project_name)
    graph_path = project_root / "graphify-out" / "graph.json"
    if not graph_path.exists():
        return {
            "project_name": project_name,
            "project_root": str(project_root),
            "status": "error",
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
            },
            "status": "ok",
        }
    except Exception as exc:
        return {
            "project_name": project_name,
            "project_root": str(project_root),
            "status": "error",
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
