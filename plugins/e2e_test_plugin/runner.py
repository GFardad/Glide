"""Main entry point for the real E2E test plugin."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from plugins.e2e_test_plugin.adapters.graphify import graphify_project
from plugins.e2e_test_plugin.adapters.log_mapper import discover_logs_and_modules
from plugins.e2e_test_plugin.adapters.surface import audit_surfaces
from plugins.e2e_test_plugin.adapters.task_runner import execute_real_task
from plugins.e2e_test_plugin.adapters.verify import run_unit_tests_and_lsp
from plugins.e2e_test_plugin.report import write_summary


def run_plugin(project_name: str, project_root: Path, output_dir: Path) -> dict[str, Any]:
    output: dict[str, Any] = {
        "plugin": "e2e-test-plugin",
        "project_name": project_name,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "steps": [],
    }

    graph = graphify_project(project_name)
    output["steps"].append({"id": "graphify", "status": graph.get("status", "error"), "result": graph})

    log_map = discover_logs_and_modules(project_root)
    output["steps"].append({"id": "log_map", "status": log_map.get("status", "error"), "result": log_map})

    surfaces = audit_surfaces(project_root)
    output["steps"].append({"id": "surface_audit", "status": surfaces.get("status", "error"), "result": surfaces})

    task_result = execute_real_task(project_root, surfaces)
    output["steps"].append({"id": "real_task", "status": task_result.get("status", "error"), "result": task_result})

    verification = run_unit_tests_and_lsp(project_root)
    output["steps"].append({"id": "unit_lsp", "status": verification.get("status", "error"), "result": verification})

    output["finished_at"] = datetime.now(timezone.utc).isoformat()
    output["status"] = "ok"

    summary_path = write_summary(output_dir, output)
    output["summary_path"] = str(summary_path)
    return output


def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: python -m plugins.e2e_test_plugin.runner <project_name> <project_root> [output_dir]")
        raise SystemExit(1)

    project_name = sys.argv[1]
    project_root = Path(sys.argv[2]).resolve()
    output_dir = Path(sys.argv[3]).resolve() if len(sys.argv) > 3 else project_root / ".e2e-test-plugin"
    output_dir.mkdir(parents=True, exist_ok=True)

    result = run_plugin(project_name, project_root, output_dir)
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()
