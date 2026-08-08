"""Loop B monitor — runtime output improvement scanner.

This module provides monitoring that scans workspace artifacts
and returns structured improvement scans for Loop B interventions.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, List, Optional


@dataclass(frozen=True)
class AgentScan:
    agent_id: str
    status: str
    signals: List[dict[str, Any]] = field(default_factory=list)
    details: dict[str, Any] = field(default_factory=dict)


class LoopBMonitor:
    """Scan runtime artifacts and produce improvement scans."""

    def __init__(self, workspace: Optional[str] = None, root: Optional[str | Path] = None) -> None:
        self.workspace = Path(workspace) if workspace else Path("/tmp/glideloop-workspace")
        if root is not None:
            self.root = Path(root)
        else:
            env_root = Path(os.environ.get("GLIDELOOP_ROOT", "/home/gfardad/projects/glideloop"))
            self.root = env_root
        self._patterns = re.compile(
            r"(placeholder|todo|fixme|hack|workaround|temporary)",
            re.IGNORECASE,
        )

    def scan(self, agent_id: str) -> AgentScan:
        """Scan one agent's artifacts and return an improvement scan."""
        artifacts = self._resolve_artifacts(agent_id)
        if not artifacts:
            return AgentScan(agent_id=agent_id, status="ok", signals=[], details={"artifact_count": 0})

        signals: List[dict[str, Any]] = []
        details: dict[str, Any] = {}

        notes_content = artifacts.get("NOTES.md", "")
        todo_content = artifacts.get("TODO.md", "")
        personality_content = artifacts.get("PERSONALITY.md", "")

        signals.extend(self._detect_repetitive_failures(notes_content))
        signals.extend(self._detect_placeholder_output(notes_content, todo_content))
        signals.extend(self._detect_todo_stall(todo_content))
        signals.extend(self._detect_missing_personality(personality_content))

        status = "flagged" if signals else "ok"
        details = {
            "artifact_count": len(artifacts),
            "notes_length": len(notes_content),
            "todo_lines": len([line for line in todo_content.splitlines() if line.strip()]),
        }
        return AgentScan(agent_id=agent_id, status=status, signals=signals, details=details)

    def _resolve_artifacts(self, agent_id: str) -> dict[str, str]:
        agent_dir = self.workspace / "agents" / agent_id
        artifacts: dict[str, str] = {}
        for name in ["NOTES.md", "TODO.md", "PERSONALITY.md", "GOAL.md", "REJECTED.md"]:
            path = agent_dir / name
            if path.exists():
                artifacts[name] = path.read_text(encoding="utf-8")
        return artifacts

    def _detect_repetitive_failures(self, notes: str) -> List[dict[str, Any]]:
        signals: List[dict[str, Any]] = []
        lines = [line.strip() for line in notes.splitlines() if line.strip()]
        counts: dict[str, int] = {}
        for line in lines:
            normalized = " ".join(line.lower().split())
            if len(normalized) < 20:
                continue
            counts[normalized] = counts.get(normalized, 0) + 1
            if counts[normalized] >= 3:
                signals.append(
                    {
                        "type": "repetitive_failure",
                        "detail": f"Repeated failure line: {normalized[:120]}",
                    }
                )
                break
        return signals

    def _detect_placeholder_output(self, notes: str, todos: str) -> List[dict[str, Any]]:
        signals: List[dict[str, Any]] = []
        text = "\n".join([notes, todos])
        matches = self._patterns.findall(text)
        if matches:
            signals.append(
                {
                    "type": "placeholder_output",
                    "detail": sorted(set(matches)),
                }
            )
        return signals

    def _detect_todo_stall(self, todos: str) -> List[dict[str, Any]]:
        signals: List[dict[str, Any]] = []
        pending = [line for line in todos.splitlines() if line.strip().startswith("- [ ]")]
        if len(pending) >= 3:
            signals.append(
                {
                    "type": "todo_stall",
                    "detail": f"{len(pending)} pending todos",
                }
            )
        return signals

    def _detect_missing_personality(self, personality: str) -> List[dict[str, Any]]:
        signals: List[dict[str, Any]] = []
        if not personality.strip():
            signals.append(
                {
                    "type": "missing_personality",
                    "detail": "PERSONALITY.md is empty or missing",
                }
            )
        return signals
