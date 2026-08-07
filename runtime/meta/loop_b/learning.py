"""Loop B learning — experience replay and pattern extraction."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

__all__ = ["LoopBMemory", "InterventionRecord", "intervention_record_path"]

_DEFAULT_ROOT = Path("/tmp/glideloop-loop-b")


@dataclass(frozen=True)
class InterventionRecord:
    session_id: str
    agent_id: str
    timestamp: str
    signal: str
    strategy: str
    outcome: str
    quality_delta: Optional[float] = None
    notes: Optional[str] = None


class LoopBMemory:
    def __init__(self, root: Optional[str] = None) -> None:
        self.root = Path(root) if root else _DEFAULT_ROOT
        for relative in ["interventions", "hindsight", "patterns"]:
            (self.root / relative).mkdir(parents=True, exist_ok=True)

    def record(self, record: InterventionRecord | dict) -> Path:
        if isinstance(record, dict):
            record = InterventionRecord(**record)
        path = self.root / "interventions" / intervention_record_path(record)
        with path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(_record_to_json(record), ensure_ascii=False) + "\n")
        return path

    def extract_patterns(self) -> list[dict]:
        patterns: dict[str, dict] = {}
        for path in (self.root / "interventions").glob("*.jsonl"):
            try:
                for line in path.read_text(encoding="utf-8").splitlines():
                    if not line.strip():
                        continue
                    payload = json.loads(line)
                    key = f"{payload.get('signal')}::{payload.get('strategy')}"
                    entry = patterns.setdefault(
                        key,
                        {"signal": payload.get("signal"), "strategy": payload.get("strategy"), "count": 0, "outcomes": []},
                    )
                    entry["count"] += 1
                    entry["outcomes"].append(payload.get("outcome"))
            except Exception:
                continue
        extracted = []
        for entry in patterns.values():
            success = sum(1 for outcome in entry["outcomes"] if outcome == "success")
            extracted.append(
                {
                    "signal": entry["signal"],
                    "strategy": entry["strategy"],
                    "count": entry["count"],
                    "success_rate": success / len(entry["outcomes"]) if entry["outcomes"] else 0.0,
                }
            )
        return sorted(extracted, key=lambda item: (-item["success_rate"], -item["count"]))[:20]


def _record_to_json(record: InterventionRecord) -> dict:
    return {
        "session_id": record.session_id,
        "agent_id": record.agent_id,
        "timestamp": record.timestamp,
        "signal": record.signal,
        "strategy": record.strategy,
        "outcome": record.outcome,
        "quality_delta": record.quality_delta,
        "notes": record.notes,
    }


def intervention_record_path(record: InterventionRecord) -> str:
    safe_ts = record.timestamp.replace(":", "-")
    return f"{record.session_id}_{safe_ts}_{record.agent_id}.jsonl"
