"""Meeting room runtime: distinct personality agents that debate an objective."""

from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from runtime.logging import get_logger, log_event

__all__ = ["PersonalityAgent", "MeetingRoom", "MeetingBrief"]

_LOGGER = get_logger("glideloop.meeting")

_DEFAULT_ROLES: list[str] = ["architect", "engineer", "security", "qa", "product"]

_ROLE_MANDATES: dict[str, dict[str, Any]] = {
    "architect": {
        "mandate": "You evaluate structural boundaries, interfaces, and long-term maintainability.",
        "constraints": [
            "Do not approve designs without explicit interface contracts",
            "Do not ignore backward compatibility",
            "Do not approve changes that increase coupling without mitigation",
        ],
        "output_schema": ["Summary", "Structural Risks", "Recommended Boundaries", "Open Questions"],
        "perspective": "You view every idea as a system boundary problem.",
    },
    "engineer": {
        "mandate": "You evaluate implementation feasibility, effort, and operational risk.",
        "constraints": [
            "Do not approve estimates without evidence",
            "Do not ignore failure modes",
            "Do not approve changes without a rollback path",
        ],
        "output_schema": ["Summary", "Feasibility", "Task Breakdown", "Risks", "Open Questions"],
        "perspective": "You view every idea through the lens of 'can we build this safely?'",
    },
    "security": {
        "mandate": "You evaluate threat exposure, permissions, and isolation boundaries.",
        "constraints": [
            "Do not approve designs that widen trust boundaries",
            "Do not ignore audit requirements",
            "Do not approve credential or secret handling without review",
        ],
        "output_schema": ["Summary", "Threat Model", "Permission Changes", "Residual Risks"],
        "perspective": "You view every idea as an attack surface change.",
    },
    "qa": {
        "mandate": "You evaluate acceptance criteria, testability, and rollback behavior.",
        "constraints": [
            "Do not approve plans without pass criteria",
            "Do not ignore regression risk",
            "Do not approve releases without rollback validation",
        ],
        "output_schema": ["Summary", "Acceptance Criteria", "Test Strategy", "Rollback Criteria"],
        "perspective": "You view every idea as a set of testable invariants.",
    },
    "product": {
        "mandate": "You evaluate user impact, scope, and prioritization.",
        "constraints": [
            "Do not approve scope without value justification",
            "Do not ignore user-facing risk",
            "Do not approve priority without constraints",
        ],
        "output_schema": ["Summary", "User Impact", "Scope", "Priority Rationale"],
        "perspective": "You view every idea through user value and delivery cost.",
    },
}


def _build_perspective(role: str, objective: str, workspace: Path) -> dict[str, Any]:
    signals = _derive_signals(role, objective)
    if any("blocking" in signal.lower() or "violat" in signal.lower() for signal in signals):
        recommendation = "revise"
        constraints_met = False
    elif signals:
        recommendation = "accept_with_notes"
        constraints_met = True
    else:
        recommendation = "accept"
        constraints_met = True
    return {
        "role": role,
        "summary": f"{role}: objective '{objective}' is {'acceptable with notes' if recommendation != 'revise' else 'not ready'}.",
        "signals": signals,
        "constraints_met": constraints_met,
        "recommendation": recommendation,
        "concerns": [signal for signal in signals if "blocking" in signal.lower() or "violat" in signal.lower()],
        "artifacts": [str(workspace / name) for name in ("PERSONALITY.md", "GOAL.md", "NOTES.md", "TODO.md", "REJECTED.md")],
        "timestamp": time.time(),
    }


def _derive_signals(role: str, objective: str) -> list[str]:
    text = objective.lower()
    if role == "architect":
        return _architect_signals(text)
    if role == "engineer":
        return _engineer_signals(text)
    if role == "security":
        return _security_signals(text)
    if role == "qa":
        return _qa_signals(text)
    if role == "product":
        return _product_signals(text)
    return [f"{role}: objective '{objective}' lacks actionable scope"]


def _architect_signals(text: str) -> list[str]:
    signals: list[str] = []
    if "interface" not in text and "api" not in text and "contract" not in text:
        signals.append("missing interface contract")
    if "backward" not in text and "compat" not in text:
        signals.append("backward compatibility not addressed")
    if "coupling" not in text and "boundary" not in text:
        signals.append("coupling/boundary risk not mitigated")
    return signals or ["structure appears bounded"]


def _engineer_signals(text: str) -> list[str]:
    signals: list[str] = []
    if "rollback" not in text and "revert" not in text:
        signals.append("no rollback path")
    if "test" not in text and "verify" not in text:
        signals.append("verification path missing")
    if "performance" not in text and "latency" not in text and "load" not in text:
        signals.append("operational risk not evaluated")
    return signals or ["implementation path looks safe"]


def _security_signals(text: str) -> list[str]:
    signals: list[str] = []
    if "auth" not in text and "permission" not in text and "secret" not in text:
        signals.append("trust boundary not explicit")
    if "audit" not in text and "log" not in text and "trace" not in text:
        signals.append("audit trail not specified")
    if "input" in text and "sanitize" not in text and "validate" not in text:
        signals.append("input validation missing — blocking")
    return signals or ["attack surface appears contained"]


def _qa_signals(text: str) -> list[str]:
    signals: list[str] = []
    if "criteria" not in text and "acceptance" not in text:
        signals.append("acceptance criteria missing")
    if "regression" not in text and "rollback" not in text:
        signals.append("regression/rollback criteria missing")
    if "test" not in text and "coverage" not in text:
        signals.append("test strategy missing")
    return signals or ["testability is acceptable"]


def _product_signals(text: str) -> list[str]:
    signals: list[str] = []
    if "user" not in text and "impact" not in text:
        signals.append("user impact undefined")
    if "priority" not in text and "value" not in text:
        signals.append("value/priority justification missing")
    if "scope" not in text:
        signals.append("scope not bounded")
    return signals or ["scope/value appears bounded"]


@dataclass(frozen=True)
class MeetingBrief:
    objective: str
    roles_participated: list[str]
    disagreements: list[dict[str, Any]]
    agreements: list[dict[str, Any]]
    recommendation: str
    minutes_path: str
    duration_ms: float


@dataclass
class PersonalityAgent:
    role: str
    objective: str
    workspace: Path

    def __post_init__(self) -> None:
        self.workspace.mkdir(parents=True, exist_ok=True)
        mandate = _ROLE_MANDATES.get(self.role, _ROLE_MANDATES["engineer"])
        personality = self.workspace / "PERSONALITY.md"
        if not personality.exists():
            personality.write_text(
                "\n".join(
                    [
                        f"# Role: {self.role}",
                        "",
                        "## Mandate",
                        mandate["mandate"],
                        "",
                        "## Constraints",
                        *[f"- {item}" for item in mandate["constraints"]],
                        "",
                        "## Output Schema",
                        *[f"- {item}" for item in mandate["output_schema"]],
                        "",
                        "## Perspective",
                        mandate["perspective"],
                        "",
                        "## Tool Access",
                        "ALL",
                        "",
                        "## Escalation Rules",
                        "- Escalate if constraints are violated by the objective",
                    ]
                ),
                encoding="utf-8",
            )
        goal = self.workspace / "GOAL.md"
        if not goal.exists():
            goal.write_text(
                "\n".join(
                    [
                        "# Goal",
                        "",
                        "## Objective",
                        self.objective,
                        "",
                        "## Assigned By",
                        "CEO/MeetingRoom",
                        "",
                        f"## Role",
                        self.role,
                        "",
                        "## Output",
                        "Produce a 1-page perspective on the objective using your PERSONALITY.md rules.",
                    ]
                ),
                encoding="utf-8",
            )
        for name in ("NOTES.md", "TODO.md", "REJECTED.md"):
            path = self.workspace / name
            if not path.exists():
                path.write_text("", encoding="utf-8")

    def run(self) -> dict[str, Any]:
        timestamp = time.time()
        log_event(_LOGGER, "meeting_role_started", {"role": self.role, "objective": self.objective})
        perspective = _build_perspective(self.role, self.objective, self.workspace)
        (self.workspace / "NOTES.md").write_text(
            "\n".join(
                [
                    f"## {time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(timestamp))}",
                    f"Evaluated objective from {self.role} perspective.",
                    "",
                    "### Key Signals",
                    *[f"- {line}" for line in perspective.get("signals", [])],
                    "",
                    "### Decision",
                    f"- recommendation={perspective.get('recommendation', 'unknown')}",
                    f"- constraints_met={perspective.get('constraints_met', True)}",
                ]
            )
            + "\n",
            encoding="utf-8",
        )
        log_event(_LOGGER, "meeting_role_completed", {"role": self.role, "recommendation": perspective["recommendation"]})
        return perspective


class MeetingRoom:
    def __init__(self, objective: str, roles: list[str] | None = None, minutes_dir: str | None = None) -> None:
        self.objective = objective
        self.roles = roles or _DEFAULT_ROLES
        root = Path("/home/gfardad/projects/glideloop")
        self.room_dir = root / "runtime" / "meeting_room"
        self.room_dir.mkdir(parents=True, exist_ok=True)
        self.minutes_dir = Path(minutes_dir) if minutes_dir else self.room_dir / "minutes"
        self.minutes_dir.mkdir(parents=True, exist_ok=True)

    def run(self) -> MeetingBrief:
        started = time.time()
        log_event(_LOGGER, "meeting_started", {"objective": self.objective, "roles": self.roles})
        outcomes: list[dict[str, Any]] = []
        for index, role in enumerate(self.roles):
            workspace = self.room_dir / "agents" / f"{role}-{index}"
            agent = PersonalityAgent(role=role, objective=self.objective, workspace=workspace)
            outcomes.append(agent.run())

        disagreements: list[dict[str, Any]] = []
        agreements: list[dict[str, Any]] = []
        for outcome in outcomes:
            if outcome.get("recommendation") == "revise":
                disagreements.append({"role": outcome["role"], "concerns": outcome.get("concerns", [])})
            else:
                agreements.append({"role": outcome["role"], "summary": outcome.get("summary", "")})

        if disagreements:
            recommendation = "accept_with_notes" if len(agreements) > len(disagreements) else "revise"
        else:
            recommendation = "accept"

        duration_ms = (time.time() - started) * 1000
        minutes_name = f"{time.strftime('%Y%m%d-%H%M%S', time.gmtime(started))}_meeting.md"
        minutes_path = self.minutes_dir / minutes_name
        agreement_lines = [f"- {item['role']}: {item['summary']}" for item in agreements] or ["- none"]
        disagreement_lines = [f"- {item['role']}: {', '.join(item.get('concerns', [])) or 'flagged without detail'}" for item in disagreements] or ["- none"]
        lines = [
            f"# Meeting Minutes: {self.objective}",
            f"## Date: {time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(started))}",
            f"## Roles: {', '.join(self.roles)}",
            "## Perspectives",
        ]
        for outcome in outcomes:
            lines.extend([f"- {outcome['role']}: {outcome.get('summary', '')}", f"  recommendation={outcome.get('recommendation', 'unknown')}"])
        lines.extend(
            [
                "## Agreements",
                *agreement_lines,
                "## Disagreements",
                *disagreement_lines,
                "## Recommendation",
                f"- {recommendation}",
                "## Changes",
                "- Added: role-specific perspectives with isolated artifacts",
                "- Removed: single-agent prompt chameleon pattern",
                "- Modified: CEO moderates; user never sees CTO/assistants/roles directly",
            ]
        )
        minutes_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        log_event(_LOGGER, "meeting_completed", {"objective": self.objective, "recommendation": recommendation, "duration_ms": duration_ms})
        return MeetingBrief(
            objective=self.objective,
            roles_participated=self.roles,
            disagreements=disagreements,
            agreements=agreements,
            recommendation=recommendation,
            minutes_path=str(minutes_path),
            duration_ms=duration_ms,
        )
