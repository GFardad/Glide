"""Execute a real task against the project using its available surfaces."""

from __future__ import annotations

import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def execute_real_task(project_root: Path, surfaces: dict[str, Any]) -> dict[str, Any]:
    available = surfaces.get("available", [])
    primary = surfaces.get("primary", "unknown")
    started_at = datetime.now(timezone.utc).isoformat()
    task = _choose_task(project_root, available)
    capture_path = project_root / ".e2e-test-plugin" / "task-capture.json"
    capture_path.parent.mkdir(parents=True, exist_ok=True)
    result = {
        "project_root": str(project_root),
        "available_surfaces": available,
        "primary_surface": primary,
        "chosen_task": task,
        "started_at": started_at,
        "capture_path": str(capture_path),
    }
    if primary == "cli":
        result.update(_run_cli_task(project_root, task, capture_path))
    elif primary == "web":
        result.update(_run_web_task(project_root, task, capture_path))
    else:
        result.update(_run_generic_task(project_root, task, capture_path))
    result["finished_at"] = datetime.now(timezone.utc).isoformat()
    result["status"] = "ok" if result.get("ok", False) else "error"
    return result


def _choose_task(project_root: Path, available: list[str]) -> dict[str, Any]:
    if "cli" in available:
        readme_task = _find_readme_task(project_root)
        if readme_task:
            return readme_task
        script_task = _find_pyproject_script(project_root)
        if script_task:
            return script_task
        main_task = _find_main_module_task(project_root)
        if main_task:
            return main_task
    return {"command": "python -m main --help", "description": "Run project help command"}


def _find_readme_task(project_root: Path) -> dict[str, Any] | None:
    for candidate in ["README.md", "readme.md", "Readme.md"]:
        readme = project_root / candidate
        if readme.exists():
            text = readme.read_text(encoding="utf-8", errors="ignore")
            for line in text.splitlines():
                stripped = line.strip()
                if stripped.startswith("$"):
                    return {"command": stripped.lstrip("$").strip(), "description": f"README example: {stripped}"}
                if stripped.startswith("python "):
                    return {"command": stripped, "description": f"README example: {stripped}"}
    return None


def _find_pyproject_script(project_root: Path) -> dict[str, Any] | None:
    pyproject = project_root / "pyproject.toml"
    if not pyproject.exists():
        return None
    text = pyproject.read_text(encoding="utf-8", errors="ignore")
    if "[project.scripts]" not in text:
        return None
    for line in text.splitlines():
        stripped = line.strip()
        if stripped and not stripped.startswith("[") and "=" in stripped:
            name = stripped.split("=", 1)[0].strip().strip('"').strip("'")
            return {"command": f"python -m {name}", "description": f"pyproject script: {name}"}
    return None


def _find_main_module_task(project_root: Path) -> dict[str, Any] | None:
    for path in sorted(project_root.rglob("*.py")):
        rel = path.relative_to(project_root)
        if _is_ignored(path, project_root):
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        if 'if __name__ == "__main__"' in text:
            module = ".".join(rel.with_suffix("").parts)
            return {"command": f"python -m {module}", "description": f"__main__ module: {module}"}
    return None


def _is_ignored(path: Path, project_root: Path) -> bool:
    rel = path.relative_to(project_root)
    parts = set(rel.parts)
    ignore = {".venv", "__pycache__", ".git", "node_modules", ".mypy_cache", ".ruff_cache"}
    return bool(parts & ignore)


def _run_cli_task(project_root: Path, task: dict[str, Any], capture_path: Path) -> dict[str, Any]:
    command = task.get("command", "")
    try:
        proc = subprocess.run(command, cwd=project_root, shell=True, capture_output=True, text=True, check=False)
        payload = {
            "task": task,
            "returncode": proc.returncode,
            "stdout": proc.stdout,
            "stderr": proc.stderr,
            "ok": proc.returncode == 0,
        }
        capture_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
        return payload
    except Exception as exc:
        payload = {"task": task, "ok": False, "detail": str(exc)}
        capture_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
        return payload


def _run_web_task(project_root: Path, task: dict[str, Any], capture_path: Path) -> dict[str, Any]:
    payload = {
        "task": task,
        "ok": False,
        "detail": "web surface detected but browser automation not implemented yet",
    }
    capture_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return payload


def _run_generic_task(project_root: Path, task: dict[str, Any], capture_path: Path) -> dict[str, Any]:
    payload = {
        "task": task,
        "ok": False,
        "detail": "no runnable surface detected",
    }
    capture_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return payload
