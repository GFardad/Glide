"""Glideloop quality gates."""

from __future__ import annotations

import json
import logging
import os
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

from runtime.logging import get_logger, log_event, mask_payload
from runtime.events import emit

__all__ = [
    "AcceptanceGate",
    "ParallelBranchGate",
    "ReviewResult",
    "PromotionGate",
    "accept_branch",
    "check_dev_quality",
]

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
        log_event(
            _LOGGER,
            "quality_gate_evaluated",
            {
                "threshold": self.threshold,
                "accepted": accepted,
                "results": [
                    {"branch_id": result.branch_id, "score": result.score, "accepted": result.accepted}
                    for result in results
                ],
            },
        )
        return accepted


class PromotionGate:
    """Quality gate for dev -> main promotion."""

    def __init__(self, root: Optional[str | Path] = None) -> None:
        self.root = Path(root) if root else Path(os.environ.get("GLIDELOOP_ROOT", "/home/gfardad/projects/glideloop"))

    def check(self) -> dict[str, Any]:
        checks: dict[str, Any] = {
            "tests_pass": self._check_tests(),
            "no_merge_conflicts": self._check_merge_conflicts(),
            "required_artifacts": self._check_artifacts(),
        }
        checks["accepted"] = all(checks.values())
        log_event(_LOGGER, "promotion_gate_checked", mask_payload(checks))
        emit("promotion_gate_checked", checks)
        return checks

    def _check_tests(self) -> bool:
        try:
            result = subprocess.run(
                [sys.executable, "-m", "pytest", "-q"],
                cwd=str(self.root),
                capture_output=True,
                text=True,
                check=False,
            )
            return result.returncode == 0
        except Exception as exc:
            log_event(_LOGGER, "promotion_gate_test_error", {"error": str(exc)})
            return False

    def _check_merge_conflicts(self) -> bool:
        try:
            result = subprocess.run(
                ["git", "merge", "dev", "--no-commit", "--no-ff"],
                cwd=str(self.root),
                capture_output=True,
                text=True,
                check=False,
            )
            if result.returncode != 0:
                subprocess.run(["git", "merge", "--abort"], cwd=str(self.root), check=False, capture_output=True)
                return False
            subprocess.run(["git", "merge", "--abort"], cwd=str(self.root), check=False, capture_output=True)
            return True
        except Exception as exc:
            log_event(_LOGGER, "promotion_gate_merge_error", {"error": str(exc)})
            return False

    def _check_artifacts(self) -> bool:
        artifacts = ("GOAL.md", "TODO.md", "NOTES.md", "REJECTED.md")
        return all((self.root / name).exists() for name in artifacts)


def check_dev_quality(root: Optional[str | Path] = None) -> dict[str, Any]:
    gate = PromotionGate(root)
    return gate.check()
