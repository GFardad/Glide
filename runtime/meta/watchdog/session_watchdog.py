"""Session watchdog: detect stale sessions and spawn parallel health checks."""

from __future__ import annotations

import json
import os
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from runtime.logging import get_logger, log_event

__all__ = ["SessionWatchdog", "SessionHealth", "check_agent_health"]

_LOGGER = get_logger("glideloop.watchdog")
_MAX_WORKER_AGE_SECONDS = 15 * 60  # 15 minutes
_SESSION_MAX_AGE_SECONDS = 24 * 60 * 60  # sessions can live up to 24 hours


@dataclass(frozen=True)
class SessionHealth:
    session_id: str
    agent_id: str
    created_at: str
    age_seconds: float
    status: str
    pid: int | None = None
    last_heartbeat: str | None = None
    last_log_ts: float | None = None
    log_gap_seconds: float | None = None
    verdict: str = "unknown"
    detail: str = ""


def _read_worker_json(root: Path) -> dict[str, Any]:
    try:
        return json.loads((root / "runtime" / "state" / "worker.json").read_text(encoding="utf-8"))
    except Exception:
        return {}


def _read_session_logs(session_dir: Path) -> list[dict[str, Any]]:
    log_file = session_dir / "logs" / "events.jsonl"
    if not log_file.exists():
        return []
    entries: list[dict[str, Any]] = []
    for line in log_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            entries.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return entries


def _session_age_seconds(created_at: str) -> float:
    try:
        dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - dt).total_seconds()
    except Exception:
        return 0.0


def _parse_iso(ts: str) -> float | None:
    """Return the epoch seconds for an ISO-8601 string, or None if unparseable."""
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp()
    except Exception:
        return None


def resolve_session_created_at(agent_dir: Path) -> str:
    """Best-effort session creation timestamp (ISO-8601, UTC).

    Sessions created by different code paths record their start time in
    different places: a leading ISO line in GOAL.md, or a ``## <ts>`` heading in
    NOTES.md. When neither yields a parseable timestamp we fall back to the
    directory's filesystem mtime, so staleness detection still works for
    sessions that were created without explicit metadata. Falling back to
    ``now`` here would make every session look brand-new and blind the
    watchdog into reporting a permanent "ok".
    """
    goal_md = agent_dir / "GOAL.md"
    if goal_md.exists():
        try:
            first = goal_md.read_text(encoding="utf-8").splitlines()[0].strip()
            if _parse_iso(first) is not None:
                return first
        except Exception:
            pass

    notes_md = agent_dir / "NOTES.md"
    if notes_md.exists():
        try:
            for line in notes_md.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line.startswith("## "):
                    cand = line[3:].strip()
                    if _parse_iso(cand) is not None:
                        return cand
                    break
        except Exception:
            pass

    # Fallback: directory mtime (prefer GOAL.md mtime as a proxy for creation).
    try:
        mtime = (agent_dir / "GOAL.md").stat().st_mtime
    except Exception:
        try:
            mtime = agent_dir.stat().st_mtime
        except Exception:
            mtime = time.time()
    return datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat()


def check_agent_health(agent_dir: Path, root: Path) -> SessionHealth:
    session_id = agent_dir.name
    agent_id = agent_dir.name
    created_at = resolve_session_created_at(agent_dir)
    age_seconds = _session_age_seconds(created_at)
    status = "running"
    pid = None
    last_heartbeat = None
    last_log_ts = None
    log_gap_seconds = None
    verdict = "ok"
    detail = ""

    try:
        from runtime.glideloop_orchestrator.state import OrchestratorState

        db_path = root / "runtime" / "state" / "glideloop_orchestrator.sqlite"
        state = OrchestratorState(db_path=db_path)
        conn = state.connect()
        row = conn.execute(
            "SELECT status FROM sessions WHERE session_id = ?", (session_id,)
        ).fetchone()
        conn.close()
        state.close()
        if row:
            status = row["status"]
    except Exception:
        pass

    worker = _read_worker_json(root)
    if worker.get("status") == "running":
        pid = worker.get("pid")

    log_entries = _read_session_logs(agent_dir)
    if log_entries:
        last_log_ts = log_entries[-1].get("ts")
        if last_log_ts is not None:
            log_gap_seconds = time.time() - float(last_log_ts)

    if status in ("failed", "error"):
        verdict = "dead"
        detail = f"session status={status}"
    elif pid is not None and not _pid_alive(pid):
        verdict = "dead"
        detail = f"worker pid {pid} not running"
    elif age_seconds > _SESSION_MAX_AGE_SECONDS:
        verdict = "zombie"
        detail = f"session older than 24h ({age_seconds / 3600:.1f}h)"
    elif age_seconds > _MAX_WORKER_AGE_SECONDS and log_gap_seconds is not None and log_gap_seconds > _MAX_WORKER_AGE_SECONDS:
        verdict = "stuck"
        detail = f"no log activity for {log_gap_seconds / 60:.1f}min"
    elif age_seconds > _MAX_WORKER_AGE_SECONDS and log_gap_seconds is None:
        verdict = "stale"
        detail = "session >15min with no log file"

    return SessionHealth(
        session_id=session_id,
        agent_id=agent_id,
        created_at=created_at,
        age_seconds=age_seconds,
        status=status,
        pid=pid,
        last_heartbeat=last_heartbeat,
        last_log_ts=last_log_ts,
        log_gap_seconds=log_gap_seconds,
        verdict=verdict,
        detail=detail,
    )


def _pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


class SessionWatchdog:
    """Watch runtime/workspace sessions and surface stuck/dead agents."""

    def __init__(self, root: str | Path | None = None) -> None:
        self.root = Path(root) if root else Path(os.environ.get("GLIDELOOP_ROOT", "/home/gfardad/projects/glideloop"))
        self.workspace_dir = self.root / "runtime" / "workspace"

    def scan(self) -> list[SessionHealth]:
        results: list[SessionHealth] = []
        if not self.workspace_dir.exists():
            return results

        # Skip non-session directories that live alongside real sessions
        # (e.g. aggregated "agents"/"artifacts"/"logs" dirs, and the ".archive"
        # holding for recovered sessions). They would otherwise be mis-scanned
        # as sessions with no metadata and falsely flagged.
        _NON_SESSION = {"agents", "artifacts", "logs", ".archive"}
        agent_dirs = [
            p
            for p in self.workspace_dir.iterdir()
            if p.is_dir() and p.name not in _NON_SESSION
        ]
        with ThreadPoolExecutor(max_workers=min(32, len(agent_dirs) or 1)) as pool:
            futures = {pool.submit(check_agent_health, d, self.root): d for d in agent_dirs}
            for future in as_completed(futures):
                try:
                    results.append(future.result())
                except Exception as exc:
                    _LOGGER.exception("watchdog check failed: %s", exc)
        results.sort(key=lambda r: ({"dead": 0, "stuck": 1, "zombie": 2, "stale": 3}.get(r.verdict, 4), -r.age_seconds))
        log_event(_LOGGER, "watchdog_scan", {"count": len(results), "verdicts": _verdict_counts(results)})
        return results

    def stale_or_worse(self) -> list[SessionHealth]:
        return [r for r in self.scan() if r.verdict in ("stuck", "dead", "zombie", "stale")]


def _verdict_counts(results: list[SessionHealth]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for r in results:
        counts[r.verdict] = counts.get(r.verdict, 0) + 1
    return counts


def main(argv: list[str] | None = None) -> int:
    """Entrypoint: print stale agents as JSON lines."""
    watchdog = SessionWatchdog()
    items = watchdog.stale_or_worse()
    if not items:
        print(json.dumps({"status": "ok", "stale": 0}, ensure_ascii=False))
        return 0

    payload = {
        "status": "stale",
        "stale": len(items),
        "items": [
            {
                "session_id": r.session_id,
                "agent_id": r.agent_id,
                "age_seconds": round(r.age_seconds, 1),
                "status": r.status,
                "verdict": r.verdict,
                "detail": r.detail,
                "pid": r.pid,
                "log_gap_seconds": round(r.log_gap_seconds, 1) if r.log_gap_seconds is not None else None,
            }
            for r in items
        ],
    }
    print(json.dumps(payload, ensure_ascii=False))
    return 1


if __name__ == "__main__":
    import sys

    raise SystemExit(main())
