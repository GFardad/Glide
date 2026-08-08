"""Parallel batch watchdog: spawn one health-check agent per stale session."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

from runtime.logging import get_logger, log_event

__all__ = ["run_parallel_health_checks", "main"]

_LOGGER = get_logger("glideloop.watchdog_batch")
_MAX_WORKER_AGE_SECONDS = 15 * 60  # 15 minutes
_SESSION_MAX_AGE_SECONDS = 24 * 60 * 60  # sessions can live up to 24 hours


def _run_watchdog() -> dict[str, Any]:
    script = Path(__file__).parent / "watchdog.py"
    try:
        proc = subprocess.run(
            [sys.executable, str(script)],
            capture_output=True,
            text=True,
            check=False,
            timeout=120,
        )
        if proc.stdout.strip():
            return json.loads(proc.stdout)
    except Exception as exc:
        log_event(_LOGGER, "watchdog_batch_scan_failed", {"error": str(exc)})
    return {"status": "error", "stale": 0, "items": []}


def _check_single_agent(session_id: str, root: Path) -> dict[str, Any]:
    """Run a focused health check for one session via its workspace artifacts."""
    workspace = root / "runtime" / "workspace" / session_id
    result: dict[str, Any] = {
        "session_id": session_id,
        "verdict": "unknown",
        "detail": "",
        "age_seconds": 0.0,
        "log_gap_seconds": None,
        "status": "unknown",
    }

    if not workspace.exists():
        result["verdict"] = "missing"
        result["detail"] = "workspace directory missing"
        return result

    notes = workspace / "NOTES.md"
    goal = workspace / "GOAL.md"
    logs_dir = workspace / "logs"
    events_log = logs_dir / "events.jsonl"

    created_at = None
    if goal.exists():
        try:
            created_at = goal.read_text(encoding="utf-8").splitlines()[0].split("\n")[0]
        except Exception:
            pass
    if notes.exists():
        try:
            for line in notes.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line.startswith("## "):
                    created_at = line[3:].strip()
                    break
        except Exception:
            pass
    if created_at is None:
        created_at = "2026-08-08T09:00:00Z"

    try:
        from datetime import datetime, timezone

        dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        age = (datetime.now(timezone.utc) - dt).total_seconds()
        result["age_seconds"] = age
    except Exception:
        age = 0
        result["age_seconds"] = 0.0

    # Dead/zombie from DB/age takes precedence over log-gap heuristics.
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
            result["status"] = row["status"]
            if row["status"] in ("failed", "error"):
                result["verdict"] = "dead"
                result["detail"] = f"session status={row['status']}"
                return result
    except Exception:
        pass

    if age > _SESSION_MAX_AGE_SECONDS:
        result["verdict"] = "zombie"
        result["detail"] = f"session older than 24h ({age / 3600:.1f}h)"
        return result

    if not events_log.exists():
        if age > _MAX_WORKER_AGE_SECONDS:
            result["verdict"] = "stale"
            result["detail"] = "session >15min with no log file"
        return result

    try:
        last_ts = None
        for line in events_log.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
                if "ts" in entry:
                    last_ts = float(entry["ts"])
            except json.JSONDecodeError:
                continue
        if last_ts is not None:
            gap = time.time() - last_ts
            result["log_gap_seconds"] = gap
            if gap > _MAX_WORKER_AGE_SECONDS:
                result["verdict"] = "stuck"
                result["detail"] = f"no log activity for {gap / 60:.1f}min"
            else:
                result["verdict"] = "ok"
                result["detail"] = f"last activity {gap / 60:.1f}min ago"
        else:
            result["verdict"] = "stale"
            result["detail"] = "log file empty"
    except Exception as exc:
        result["verdict"] = "error"
        result["detail"] = str(exc)

    return result


def run_parallel_health_checks(root: str | Path | None = None, max_workers: int = 8) -> dict[str, Any]:
    """Scan sessions and run parallel health checks for stale ones."""
    root = Path(root) if root else Path(os.environ.get("GLIDELOOP_ROOT", "/home/gfardad/projects/glideloop"))
    scan = _run_watchdog()
    stale = scan.get("items", []) if scan.get("status") == "stale" else []
    if not stale:
        return {"status": "ok", "checked": 0, "results": []}

    session_ids = [item["session_id"] for item in stale if item.get("session_id")]
    results: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=min(max_workers, len(session_ids) or 1)) as pool:
        futures = {pool.submit(_check_single_agent, sid, root): sid for sid in session_ids}
        for future in as_completed(futures):
            try:
                results.append(future.result())
            except Exception as exc:
                sid = futures[future]
                results.append({"session_id": sid, "verdict": "error", "detail": str(exc)})

    results.sort(key=lambda r: r.get("age_seconds", 0), reverse=True)
    verdict_counts: dict[str, int] = {}
    for r in results:
        v = r.get("verdict", "unknown")
        verdict_counts[v] = verdict_counts.get(v, 0) + 1

    log_event(_LOGGER, "watchdog_batch_completed", {"checked": len(results), "verdicts": verdict_counts})
    return {"status": "stale" if results else "ok", "checked": len(results), "results": results, "verdicts": verdict_counts}


def _archive_session(session_id: str, root: Path) -> None:
    archive_root = root / "runtime" / "workspace" / ".archive"
    src = root / "runtime" / "workspace" / session_id
    if not src.exists():
        return
    dest = archive_root / session_id
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        import shutil
        shutil.rmtree(dest)
    shutil.move(str(src), str(dest))


def _restart_session(session_id: str, root: Path) -> dict[str, Any]:
    from runtime.mcp.server import handle_tool
    import json as _json
    try:
        proc = subprocess.run(
            [sys.executable, "-c", f"import json; from runtime.mcp.server import handle_tool; print(handle_tool('glideloop_run', {{'objective': 'Recover session {session_id}'}}))"],
            cwd=root,
            capture_output=True,
            text=True,
            timeout=120,
        )
        if proc.stdout.strip():
            result = _json.loads(proc.stdout.strip())
            return {"session_id": session_id, "action": "restart", "result": result}
    except Exception as exc:
        return {"session_id": session_id, "action": "restart", "error": str(exc)}
    return {"session_id": session_id, "action": "restart", "result": {}}


def recover_sessions(root: str | Path | None = None) -> dict[str, Any]:
    """Recover stale/dead/zombie sessions: archive zombies/dead, restart stuck/stale."""
    root = Path(root) if root else Path(os.environ.get("GLIDELOOP_ROOT", "/home/gfardad/projects/glideloop"))
    report = run_parallel_health_checks(root=root)
    results = report.get("results", [])
    if not results:
        return {"status": "ok", "recovered": 0, "actions": []}

    actions: list[dict[str, Any]] = []
    for item in results:
        verdict = item.get("verdict")
        session_id = item.get("session_id")
        if verdict == "zombie":
            _archive_session(session_id, root)
            actions.append({"session_id": session_id, "action": "archive"})
        elif verdict == "dead":
            _archive_session(session_id, root)
            actions.append({"session_id": session_id, "action": "archive"})
        elif verdict in ("stuck", "stale"):
            restart = _restart_session(session_id, root)
            actions.append(restart)

    return {"status": "recovered", "recovered": len(actions), "actions": actions}


def main(argv: list[str] | None = None) -> int:
    """Entrypoint: print parallel health-check results as JSON. Use --auto-recover to fix stale sessions."""
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--auto-recover", action="store_true", help="Automatically recover stale/dead/zombie sessions")
    args = parser.parse_args(argv)
    if args.auto_recover:
        report = recover_sessions()
    else:
        report = run_parallel_health_checks()
    print(json.dumps(report, ensure_ascii=False))
    return 1 if report.get("status") in ("stale", "recovered") else 0


if __name__ == "__main__":
    import sys

    raise SystemExit(main())
