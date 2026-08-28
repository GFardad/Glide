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

# Ensure the repo root (containing the `runtime` package) is importable even when
# this script is launched without an inherited PYTHONPATH.
_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from runtime.logging import get_logger, log_event

__all__ = ["run_parallel_health_checks", "main"]

_LOGGER = get_logger("glideloop.watchdog_batch")
_MAX_WORKER_AGE_SECONDS = 15 * 60  # 15 minutes
_SESSION_MAX_AGE_SECONDS = 24 * 60 * 60  # sessions can live up to 24 hours


def _run_watchdog() -> dict[str, Any]:
    script = Path(__file__).parent / "watchdog.py"
    # Ensure the spawned watchdog can import the runtime package regardless of
    # how this batch was launched (e.g. without an inherited PYTHONPATH).
    repo_root = Path(__file__).resolve().parent.parent
    env = dict(os.environ)
    existing = env.get("PYTHONPATH", "")
    env["PYTHONPATH"] = (
        str(repo_root) + (os.pathsep + existing if existing else "")
    )
    try:
        proc = subprocess.run(
            [sys.executable, str(script)],
            capture_output=True,
            text=True,
            check=False,
            timeout=120,
            env=env,
        )
        if proc.stdout.strip():
            try:
                return json.loads(proc.stdout)
            except json.JSONDecodeError:
                log_event(
                    _LOGGER,
                    "watchdog_batch_scan_bad_output",
                    {"stderr": proc.stderr.strip()[-500:]},
                )
        else:
            log_event(
                _LOGGER,
                "watchdog_batch_scan_empty",
                {"returncode": proc.returncode, "stderr": proc.stderr.strip()[-500:]},
            )
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
        "worker_pid": None,
        "worker_alive": False,
    }

    if not workspace.exists():
        result["verdict"] = "missing"
        result["detail"] = "workspace directory missing"
        return result

    notes = workspace / "NOTES.md"
    goal = workspace / "GOAL.md"
    logs_dir = workspace / "logs"
    events_log = logs_dir / "events.jsonl"

    # Reuse the same creation-time resolution as the main watchdog so the
    # parallel batch and the single-scan never disagree on staleness.
    from runtime.meta.watchdog.session_watchdog import (
        resolve_session_created_at,
        _pid_alive,
    )

    created_at = resolve_session_created_at(workspace)

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
        # Some schemas carry a worker pid column; older ones don't. Tolerate both.
        try:
            row = conn.execute(
                "SELECT status, pid FROM sessions WHERE session_id = ?", (session_id,)
            ).fetchone()
            pid = row["pid"] if row else None
        except Exception:
            row = conn.execute(
                "SELECT status FROM sessions WHERE session_id = ?", (session_id,)
            ).fetchone()
            pid = None
        conn.close()
        state.close()
        if row:
            result["status"] = row["status"]
            result["worker_pid"] = pid
            result["worker_alive"] = _pid_alive(int(pid)) if pid is not None else False
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
    # Surface scan failures honestly instead of masking them as "ok".
    if scan.get("status") != "stale":
        return {
            "status": scan.get("status", "error"),
            "checked": 0,
            "results": [],
            "verdicts": {},
        }
    stale = scan.get("items", [])

    session_ids = [item["session_id"] for item in stale if item.get("session_id")]
    results: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=min(max_workers, len(session_ids) or 1)) as pool:
        futures = {pool.submit(_check_single_agent, sid, root): sid for sid in session_ids}
        for future in as_completed(futures):
            try:
                item_result = future.result()
            except Exception as exc:
                sid = futures[future]
                item_result = {"session_id": sid, "verdict": "error", "detail": str(exc)}

            # The single-scan already produced a defensible verdict for this
            # session. If the per-agent refinement failed to classify it
            # (verdict "unknown" or "error") we must NOT let it fall into an
            # unrecoverable bucket: recover_sessions only acts on
            # zombie/dead/stuck/stale, so an "unknown" would be reported every
            # cycle yet never drained (silent leak). Inherit the scan verdict so
            # stale sessions stay actionable.
            scan_item = next(
                (it for it in stale if it.get("session_id") == item_result.get("session_id")),
                {},
            )
            if item_result.get("verdict") in ("unknown", "error"):
                item_result["verdict"] = scan_item.get("verdict", "stale")
                item_result["detail"] = scan_item.get("detail", "") or item_result.get("detail", "")
                # The scan-level age is the trustworthy staleness signal when
                # per-agent refinement produced a default (0.0). Override it
                # unless the refinement genuinely measured a non-zero age.
                if not item_result.get("age_seconds"):
                    item_result["age_seconds"] = scan_item.get("age_seconds", 0.0)
                if not item_result.get("status"):
                    item_result["status"] = scan_item.get("status", "unknown")
                item_result["verdict_source"] = "scan_fallback"

            results.append(item_result)

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
        raw = proc.stdout.strip()
        if raw:
            last_line = raw.splitlines()[-1]
            result = _json.loads(last_line)
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
            # A session is only worth RESTARTING when a genuinely live worker
            # process is still attached (DB status running AND pid alive).
            # Orphans (no DB record) and PHANTOM sessions (DB row present but
            # the worker pid is missing/dead) must both be ARCHIVED. Restarting
            # a phantom only spawns yet another workspace, so the pile never
            # drains and the parallel batch stays permanently expensive — the
            # leak seen across prior cycles (104 -> 212 -> 224).
            if item.get("worker_alive"):
                restart = _restart_session(session_id, root)
                actions.append(restart)
            else:
                reason = (
                    "orphan_no_db_record"
                    if item.get("status") in (None, "", "unknown")
                    else "phantom_no_live_worker"
                )
                _archive_session(session_id, root)
                actions.append({"session_id": session_id, "action": "archive", "reason": reason})

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
    return 1 if report.get("status") in ("stale", "recovered", "error") else 0


if __name__ == "__main__":
    import sys

    raise SystemExit(main())
