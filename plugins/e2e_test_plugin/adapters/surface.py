"""Surface audit adapter: detect CLI, TUI, or WEB."""

from __future__ import annotations

from pathlib import Path
from typing import Any


def audit_surfaces(project_root: Path) -> dict[str, Any]:
    runtime_text = _read_runtime_text(project_root)
    readme = _read_readme(project_root)
    pyproject = _read_pyproject(project_root)
    surfaces = {
        "cli": _detect_cli(runtime_text, readme, pyproject),
        "tui": _detect_tui(runtime_text),
        "web": _detect_web(runtime_text),
    }
    available = [key for key, detected in surfaces.items() if detected]
    confidence = _confidence(available, runtime_text, readme, pyproject)
    return {
        "surfaces": surfaces,
        "available": available,
        "primary": available[0] if available else "unknown",
        "confidence": confidence,
        "status": "ok",
    }


def _confidence(available: list[str], runtime_text: str, readme: str, pyproject: str) -> dict[str, str]:
    confidence: dict[str, str] = {}
    if "cli" in available:
        if "console_scripts" in pyproject or "[project.scripts]" in pyproject:
            confidence["cli"] = "high"
        elif any(marker in runtime_text for marker in ["argparse", "click", "typer"]):
            confidence["cli"] = "medium"
        else:
            confidence["cli"] = "low"
    if "tui" in available:
        confidence["tui"] = "high" if "textual" in runtime_text else "low"
    if "web" in available:
        web_markers = ["flask", "fastapi", "django", "starlette", "uvicorn", "aiohttp"]
        if any(marker in runtime_text for marker in web_markers):
            confidence["web"] = "high"
        elif any(marker in readme for marker in web_markers):
            confidence["web"] = "medium"
        else:
            confidence["web"] = "low"
    return confidence


def _detect_cli(text: str, readme: str, pyproject: str) -> bool:
    high_cli = "console_scripts" in pyproject or "[project.scripts]" in pyproject
    medium_cli = any(marker in text for marker in ["argparse", "click", "typer"])
    low_cli = any(marker in text or marker in readme or marker in pyproject for marker in ["sys.argv", "python -m"])
    return bool(high_cli or medium_cli or low_cli)


def _detect_tui(text: str) -> bool:
    runtime_tui = any(marker in text for marker in ["textual", "npyscreen", "urwid"])
    if not runtime_tui:
        return False
    exclusion_contexts = ["test", "tests", "docs", "dev", "ci"]
    lines = text.splitlines()
    for line in lines:
        lowered = line.lower()
        if any(marker in lowered for marker in ["textual", "npyscreen", "urwid"]):
            if not any(ctx in lowered for ctx in exclusion_contexts):
                return True
    return False


def _detect_web(text: str) -> bool:
    return any(marker in text for marker in ["flask", "fastapi", "django", "starlette", "uvicorn", "aiohttp", "selenium", "playwright"])


def _read_runtime_text(project_root: Path) -> str:
    runtime_dirs = {"runtime", "plugins", "src", "app", "glideloop"}
    parts: list[str] = []
    for path in project_root.rglob("*"):
        if not path.is_file() or _is_ignored(path, project_root):
            continue
        if path.suffix.lower() not in {".py", ".toml", ".cfg", ".ini", ".md", ".json", ".yaml", ".yml", ".txt"}:
            continue
        rel = path.relative_to(project_root)
        if rel.parts and rel.parts[0] in runtime_dirs:
            try:
                parts.append(path.read_text(encoding="utf-8", errors="ignore"))
            except Exception:
                continue
    return "\n".join(parts)


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
