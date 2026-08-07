"""Report adapter: generate complete E2E markdown summary."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def write_summary(output_dir: Path, result: dict[str, Any]) -> Path:
    summary_path = output_dir / "e2e-summary.md"
    lines = [
        f"# E2E Summary: {result.get('project_name')}",
        "",
        f"- plugin: {result.get('plugin')}",
        f"- started_at: {result.get('started_at')}",
        f"- finished_at: {result.get('finished_at')}",
        f"- status: {result.get('status')}",
        "",
        "## Steps",
        "",
    ]
    for step in result.get("steps", []):
        lines.append(f"- {step.get('id')}: {step.get('status')}")
    lines.extend(["", "## Details", "", "```json", json.dumps(result, indent=2, ensure_ascii=False), "```"])
    summary_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return summary_path
