"""Glideloop quality gates."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from runtime.logging import get_logger, log_event

__all__ = ["AcceptanceGate", "ParallelBranchGate", "ReviewResult", "accept_branch"]

_LOGGER = get_logger("glideloop.quality")


@dataclass(frozen=True)
class AcceptanceGate:
    name: str
    predicate: callable


@dataclass(frozen=True)
class ReviewResult:
    branch_id: str
    score: float
    accepted: bool
    notes: str


def _default_acceptance(output: str) -> bool:
    if not output or not output.strip():
        return False
    required_artifacts = ("GOAL.md", "TODO.md", "NOTES.md", "REJECTED.md")
    return all(artifact in output for artifact in required_artifacts)


def accept_branch(output: str, gates: Optional[list[AcceptanceGate]] = None) -> bool:
    checks = list(gates) if gates else []
    checks.append(AcceptanceGate("default", lambda text: _default_acceptance(text)))
    return all(gate.predicate(output) for gate in checks)


class ParallelBranchGate:
    def __init__(self, threshold: float = 0.9) -> None:
        self.threshold = threshold

    def accept(self, results: list[ReviewResult]) -> bool:
        if not results:
            log_event(_LOGGER, "quality_gate_rejected", {"reason": "empty_results"})
            return False
        accepted = all(result.accepted and result.score >= self.threshold for result in results)
        log_event(_LOGGER, "quality_gate_evaluated", {"threshold": self.threshold, "accepted": accepted, "results": [{"branch_id": result.branch_id, "score": result.score, "accepted": result.accepted} for result in results]})
        return accepted
