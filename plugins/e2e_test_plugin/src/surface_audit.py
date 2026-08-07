"""Audit how the project is available: CLI, TUI, WEB."""

from __future__ import annotations

from pathlib import Path
from typing import Any


def audit_surfaces(project_root: Path) -> dict[str, Any]:
    text = _read_text(project_root)
    readme = _read_readme(project_root)
    pyproject = _read_pyproject(project_root)
    surfaces = {
        "cli": _detect_cli(text, readme, pyproject),
        "tui": _detect_tui(text),
        "web": _detect_web(text),
    }
    available = [key for key, detected in surfaces.items() if detected]
    return {
        "surfaces": surfaces,
        "available": available,
        "primary": available[0] if available else "unknown",
        "status": "ok",
    }


def _detect_cli(text: str, readme: str, pyproject: str) -> bool:
    markers = ["argparse", "click", "typer", "console_scripts", "[project.scripts]", "sys.argv"]
    return any(marker in text or marker in readme or marker in pyproject for marker in markers)


def _detect_tui(text: str) -> bool:
    markers = ["textual", "npyscreen", "urwid"]
    return any(marker in text for marker in markers)


def _detect_web(text: str) -> bool:
    markers = ["flask", "fastapi", "django", "starlette", "uvicorn", "aiohttp", "selenium", "playwright"]
    return any(marker in text for marker in markers)


def _read_text(project_root: Path) -> str:
    parts: list[str] = []
    for path in project_root.rglob("*"):
        if path.is_file() and not _is_ignored(path, project_root) and path.suffix.lower() in {".py", ".toml", ".cfg", ".ini", ".md", ".json", ".yaml", ".yml", ".txt"}:
            try:
                parts.append(path.read_text(encoding="utf-8", errors="ignore"))
            except Exception:
                continue
    return "\n".join(parts)


def _read_readme(project_root: Path) -> str:
    for candidate in ["README.md", "readme.md", "Readme.md"]:
        readme = project_root / candidate
        if readme.exists():
            return readme.read_text(encoding="utf-8", errors="ignore")
    return ""


def _read_pyproject(project_root: Path) -> str:
    pyproject = project_root / "pyproject.toml"
    if pyproject.exists():
        return pyproject.read_text(encoding="utf-8", errors="ignore")
    return ""


def _is_ignored(path: Path, project_root: Path) -> bool:
    rel = path.relative_to(project_root)
    parts = set(rel.parts)
    ignore = {".venv", "__pycache__", ".git", "node_modules", ".mypy_cache", ".ruff_cache"}
    return bool(parts & ignore)
