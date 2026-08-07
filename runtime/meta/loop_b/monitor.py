"""Loop B monitor — scans agent artifacts for stuck/low-quality signals."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

__all__ = ["AgentScan", "LoopBMonitor"]

_REPEAT_ERROR_THRESHOLD = 3
_REJECTION_THRESHOLD = 2


@dataclass(frozen=True)
class AgentScan:
    agent_id: str
    status: str
    signals: list[dict]
    details: dict


class LoopBMonitor:
    def __init__(self, workspace: Optional[str] = None) -> None:
        self.workspace = Path(workspace) if workspace else Path("/tmp/glideloop-workspace")

    def scan(self, agent_id: str) -> AgentScan:
        agent_dir = self.workspace / "agents" / agent_id
        if not agent_dir.exists():
            return AgentScan(agent_id=agent_id, status="unknown", signals=[], details={"reason": "missing_agent_dir"})

        notes_text = _read_text(agent_dir / "NOTES.md")
        todo_text = _read_text(agent_dir / "TODO.md")
        rejected_text = _read_text(agent_dir / "REJECTED.md")
        personality_text = _read_text(agent_dir / "PERSONALITY.md")

        signals: list[dict] = []
        details: dict = {}

        error_matches = re.findall(r"Error: .+", notes_text, flags=re.IGNORECASE)
        if len(error_matches) >= _REPEAT_ERROR_THRESHOLD:
            signals.append({"type": "repetitive_failure", "detail": error_matches[-_REPEAT_ERROR_THRESHOLD:]})
            details["repetitive_failure_count"] = len(error_matches)

        if "Empty or placeholder output" in rejected_text or "placeholder" in rejected_text.lower():
            signals.append({"type": "placeholder_output"})
            details["placeholder_output"] = True

        rejection_count = rejected_text.count("## Rejected") + rejected_text.count("# Rejected") + rejected_text.count("REJECTED")
        if rejection_count >= _REJECTION_THRESHOLD:
            signals.append({"type": "rejection_spam", "detail": rejection_count})
            details["rejection_count"] = rejection_count

        todo_items = [line.strip() for line in todo_text.splitlines() if line.strip().startswith("- [ ]")]
        done_items = [line.strip() for line in todo_text.splitlines() if line.strip().startswith("- [x]")]
        if todo_items and not done_items:
            signals.append({"type": "todo_stall", "detail": {"pending": len(todo_items), "done": len(done_items)}})
            details["todo_stall"] = True

        if not personality_text.strip():
            signals.append({"type": "missing_personality"})
            details["missing_personality"] = True

        status = "flagged" if signals else "ok"
        return AgentScan(agent_id=agent_id, status=status, signals=signals, details=details)


def _read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except Exception:
        return ""
