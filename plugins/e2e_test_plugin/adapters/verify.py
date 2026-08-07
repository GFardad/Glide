"""Verification adapter: unit tests + LSP checks."""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any


def run_unit_tests_and_lsp(project_root: Path) -> dict[str, Any]:
    unit = _run_unit_tests(project_root)
    lsp = _run_lsp(project_root)
    return {
        "unit_tests": unit,
        "lsp": lsp,
        "passed": unit.get("passed", False) and lsp.get("passed", False),
        "status": "ok",
    }


def _run_unit_tests(project_root: Path) -> dict[str, Any]:
    candidates = ["pytest", "python -m pytest", "python -m unittest discover"]
    for command in candidates:
        try:
            proc = subprocess.run(command, cwd=project_root, shell=True, capture_output=True, text=True, check=False, timeout=300)
            if proc.returncode == 0 or "passed" in proc.stdout.lower() or "ok" in proc.stdout.lower():
                return {
                    "command": command,
                    "returncode": proc.returncode,
                    "stdout": proc.stdout,
                    "stderr": proc.stderr,
                    "passed": proc.returncode == 0,
                    "status": "ok",
                }
        except Exception:
            continue
    return {"command": None, "passed": False, "status": "error", "detail": "no unit-test command succeeded"}


def _run_lsp(project_root: Path) -> dict[str, Any]:
    try:
        files: list[str] = []
        for path in project_root.rglob("*.py"):
            if _is_ignored(path, project_root):
                continue
            files.append(str(path))
        if not files:
            return {"command": "python -m py_compile", "passed": True, "status": "ok", "detail": "no python files"}
        procs = []
        for file in files:
            proc = subprocess.run(["python", "-m", "py_compile", file], capture_output=True, text=True, check=False)
            procs.append((file, proc))
        failed = [(file, proc) for file, proc in procs if proc.returncode != 0]
        if failed:
            file, proc = failed[0]
            return {
                "command": f"python -m py_compile {file}",
                "returncode": proc.returncode,
                "stdout": proc.stdout,
                "stderr": proc.stderr,
                "passed": False,
                "status": "ok",
                "detail": f"{len(failed)} file(s) failed",
            }
        return {
            "command": "python -m py_compile",
            "returncode": 0,
            "stdout": "",
            "stderr": "",
            "passed": True,
            "status": "ok",
            "detail": f"compiled {len(files)} files",
        }
    except Exception as exc:
        return {"command": None, "passed": False, "status": "error", "detail": str(exc)}


def _is_ignored(path: Path, project_root: Path) -> bool:
    rel = path.relative_to(project_root)
    parts = set(rel.parts)
    ignore = {".venv", "__pycache__", ".git", "node_modules", ".mypy_cache", ".ruff_cache"}
    return bool(parts & ignore)
