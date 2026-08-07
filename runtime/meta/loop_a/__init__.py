"""Loop A — weekly system self-improvement: artifact store, observer, proposer, validator, promoter."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from runtime.logging import get_logger, log_event

__all__ = [
    "ArtifactMeta",
    "ArtifactStore",
    "LoopAObserver",
    "LoopAProposer",
    "LoopAValidator",
    "LoopAPromoter",
]

_LOGGER = get_logger("glideloop.loop_a")


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(frozen=True)
class ArtifactMeta:
    artifact_id: str
    version: str
    parent_version: Optional[str]
    created_at: str
    change_summary: str
    validation_score: Optional[float] = None
    status: str = "candidate"

    def to_json(self) -> dict:
        return {
            "artifact_id": self.artifact_id,
            "version": self.version,
            "parent_version": self.parent_version,
            "created_at": self.created_at,
            "change_summary": self.change_summary,
            "validation_score": self.validation_score,
            "status": self.status,
        }

    @classmethod
    def from_json(cls, data: dict) -> "ArtifactMeta":
        return cls(
            artifact_id=data["artifact_id"],
            version=data["version"],
            parent_version=data.get("parent_version"),
            created_at=data["created_at"],
            change_summary=data.get("change_summary", ""),
            validation_score=data.get("validation_score"),
            status=data.get("status", "candidate"),
        )


class ArtifactStore:
    def __init__(self, root: Optional[str] = None) -> None:
        self.root = Path(root) if root else Path("/tmp/glideloop-loop-a")
        for relative in [
            "stable/prompts",
            "stable/strategies",
            "stable/personalities",
            "candidates/prompts",
            "candidates/strategies",
            "candidates/personalities",
            "rejected/prompts",
            "rejected/strategies",
            "rejected/personalities",
            "validation/reports",
            "validation/episodes.jsonl",
            "validation/scores.jsonl",
            "history",
            "experience/trajectories",
            "experience/reflections",
        ]:
            (self.root / relative).mkdir(parents=True, exist_ok=True)

    def current_symlink(self, kind: str, artifact_id: str) -> Path:
        return self.root / "stable" / kind / f"{artifact_id}-current"

    def write_candidate(self, kind: str, artifact_id: str, candidate_name: str, content: str, meta: ArtifactMeta) -> Path:
        destination = self.root / "candidates" / kind / candidate_name
        destination.write_text(content, encoding="utf-8")
        meta_path = destination.with_suffix(destination.suffix + ".meta.json")
        meta_path.write_text(json.dumps(meta.to_json(), indent=2), encoding="utf-8")
        log_event(_LOGGER, "loop_a_candidate_written", {"kind": kind, "artifact_id": meta.artifact_id, "candidate": candidate_name})
        return destination

    def promote(self, kind: str, artifact_id: str, candidate_name: str, meta: ArtifactMeta) -> Path:
        source = self.root / "candidates" / kind / candidate_name
        if not source.exists():
            raise FileNotFoundError(source)
        versioned_name = f"{artifact_id}-{meta.version}{source.suffix}"
        stable_path = self.root / "stable" / kind / versioned_name
        shutil.copy(source, stable_path)
        meta_path = stable_path.with_suffix(stable_path.suffix + ".meta.json")
        meta_path.write_text(json.dumps(meta.to_json() | {"status": "stable"}, indent=2), encoding="utf-8")
        current = self.current_symlink(kind, artifact_id)
        temp = self.root / "stable" / kind / f"{artifact_id}-current.tmp"
        temp.symlink_to(Path(versioned_name))
        temp.replace(current)
        (self.root / "history" / f"{_utcnow()}_{candidate_name}.md").write_text(
            f"# Promotion\n\n- candidate: {candidate_name}\n- promoted_to: {stable_path}\n- meta: {json.dumps(meta.to_json())}\n",
            encoding="utf-8",
        )
        log_event(_LOGGER, "loop_a_promoted", {"kind": kind, "artifact_id": artifact_id, "version": meta.version, "path": str(stable_path)})
        return stable_path

    def reject(self, kind: str, candidate_name: str, reason: str) -> None:
        source = self.root / "candidates" / kind / candidate_name
        target = self.root / "rejected" / kind / candidate_name
        if source.exists():
            shutil.move(source, target)
        meta = target.with_suffix(target.suffix + ".meta.json")
        if meta.exists():
            payload = json.loads(meta.read_text(encoding="utf-8"))
            payload["status"] = "rejected"
            payload["rejection_reason"] = reason
            meta.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def log_event(self, event_type: str, payload: dict) -> None:
        line = json.dumps({"timestamp": _utcnow(), "event_type": event_type, **payload})
        path = self.root / "history" / "events.jsonl"
        with path.open("a", encoding="utf-8") as handle:
            handle.write(line + "\n")
        log_event(_LOGGER, event_type, payload)


class LoopAObserver:
    def __init__(self, workspace: Optional[str] = None, store: Optional[ArtifactStore] = None) -> None:
        self.workspace = Path(workspace) if workspace else Path("/home/gfardad/projects/glideloop")
        self.store = store or ArtifactStore()

    def weekly_report(self) -> dict:
        artifact_roots = [
            self.workspace / "skills/glideloop-cto/roles",
            self.workspace / "runtime/agents",
            self.workspace / "runtime/quality",
        ]
        files = []
        for root in artifact_roots:
            if root.exists():
                files.extend(sorted(p for p in root.rglob("*.md") if p.is_file()))
        failure_signals = []
        for path in files:
            try:
                text = path.read_text(encoding="utf-8")
            except Exception:
                continue
            if "FIXME" in text or "TODO" in text:
                failure_signals.append({"path": str(path), "signal": "incomplete_artifact"})
        return {
            "timestamp": _utcnow(),
            "artifacts_scanned": len(files),
            "failure_signals": failure_signals[:20],
            "candidates": [],
        }


class LoopAProposer:
    def __init__(self, workspace: Optional[str] = None, store: Optional[ArtifactStore] = None) -> None:
        self.workspace = Path(workspace) if workspace else Path("/home/gfardad/projects/glideloop")
        self.store = store or ArtifactStore()

    def propose_team_activation_candidates(self) -> list[dict]:
        source = self.workspace / "runtime/agents/teams.py"
        if not source.exists():
            return []
        text = source.read_text(encoding="utf-8")
        candidate_name = "teams-activation-refresh.py"
        candidate_text = text
        meta = ArtifactMeta(
            artifact_id="team-activation",
            version="v1",
            parent_version=None,
            created_at=_utcnow(),
            change_summary="Candidate refresh of team activation rules.",
        )
        self.store.write_candidate("strategies", "team-activation", candidate_name, candidate_text, meta)
        self.store.log_event("candidate_proposed", {"artifact_id": meta.artifact_id, "candidate": candidate_name})
        return [{"candidate": candidate_name, "artifact_id": meta.artifact_id, "meta": meta.to_json()}]


class LoopAValidator:
    def __init__(self, store: Optional[ArtifactStore] = None) -> None:
        self.store = store or ArtifactStore()

    def validate(self, candidate_path: Path, meta: ArtifactMeta) -> dict:
        if not candidate_path.exists():
            return {"status": "fail", "reason": "missing_candidate"}
        try:
            text = candidate_path.read_text(encoding="utf-8")
        except Exception as exc:
            return {"status": "fail", "reason": f"read_failed:{exc}"}
        score = 1.0 if text.strip() else 0.0
        report = {
            "candidate": str(candidate_path),
            "current_stable": str(self.store.current_symlink(candidate_path.parent.name, meta.artifact_id)),
            "score": score,
            "status": "pass" if score >= 0.5 else "fail",
        }
        report_path = self.store.root / "validation" / "reports" / f"{_utcnow()}_{candidate_path.name}.md"
        report_path.write_text(
            f"# Validation Report\n\n```json\n{json.dumps(report, indent=2)}\n```\n",
            encoding="utf-8",
        )
        return report


class LoopAPromoter:
    def __init__(self, store: Optional[ArtifactStore] = None) -> None:
        self.store = store or ArtifactStore()
        self._rollback_count = 0

    def promote(self, kind: str, artifact_id: str, candidate_name: str, meta: ArtifactMeta) -> dict:
        try:
            stable_path = self.store.promote(kind, artifact_id, candidate_name, meta)
            return {"status": "promoted", "path": str(stable_path)}
        except Exception as exc:
            return {"status": "fail", "reason": str(exc)}

    def rollback(self, kind: str, artifact_id: str, reason: str) -> dict:
        current = self.store.current_symlink(kind, artifact_id)
        if current.exists() and current.is_symlink():
            target = current.resolve()
            temp = self.store.root / "stable" / kind / f"{artifact_id}-current.rollback"
            if target.exists():
                temp.symlink_to(target)
                temp.replace(current)
                self._rollback_count += 1
                self.store.log_event("rollback", {"artifact_id": artifact_id, "reason": reason})
                return {"status": "rolled_back", "path": str(current)}
        return {"status": "noop", "reason": reason}


if __name__ == "__main__":
    import argparse
    import sys

    parser = argparse.ArgumentParser(description="Glideloop Loop A weekly self-improvement runner")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("report", help="Run Loop A observer weekly report")
    subparsers.add_parser("propose", help="Propose Loop A improvement candidates")
    subparsers.add_parser("promote", help="Promote current Loop A candidates")

    args = parser.parse_args()
    store = ArtifactStore()
    if args.command == "report":
        observer = LoopAObserver(store=store)
        report = observer.weekly_report()
        print(json.dumps(report, indent=2))
        sys.exit(0 if not report.get("failure_signals") else 2)
    if args.command == "propose":
        proposer = LoopAProposer(store=store)
        candidates = proposer.propose_team_activation_candidates()
        print(json.dumps({"candidates": candidates}, indent=2))
        sys.exit(0)
    if args.command == "promote":
        promoter = LoopAPromoter(store=store)
        promoted = []
        for kind in ["prompts", "strategies", "personalities"]:
            for candidate in (store.root / "candidates" / kind).glob("*"):
                if candidate.is_file() and not candidate.name.endswith(".meta.json"):
                    meta_name = candidate.with_suffix(candidate.suffix + ".meta.json")
                    meta = ArtifactMeta.from_json(json.loads(meta_name.read_text(encoding="utf-8"))) if meta_name.exists() else ArtifactMeta(
                        artifact_id=candidate.stem, version="v1", parent_version=None, created_at=_utcnow(), change_summary="promoted without meta"
                    )
                    result = promoter.promote(kind, candidate.stem, candidate.name, meta)
                    promoted.append({"candidate": candidate.name, "result": result})
        print(json.dumps({"promoted": promoted}, indent=2))
        sys.exit(0)
