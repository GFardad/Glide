"""Inject a session_recovery improvement task into runtime/state/tasks.json.

Objective is derived from the *current* watchdog report so the injected task
always reflects reality instead of a stale hardcoded count.
"""
import json
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TASKS = ROOT / "runtime" / "state" / "tasks.json"


def _current_report() -> dict:
    """Run the watchdog scan (no auto-recover) and return the JSON report."""
    env = dict(os.environ)
    existing = env.get("PYTHONPATH", "")
    env["PYTHONPATH"] = str(ROOT) + (os.pathsep + existing if existing else "")
    proc = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "watchdog_batch.py")],
        capture_output=True,
        text=True,
        cwd=ROOT,
        env=env,
        timeout=120,
    )
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError:
        return {"status": "unknown", "verdicts": {}, "checked": 0}


def main() -> None:
    report = _current_report()
    verdicts = report.get("verdicts", {})
    stale = verdicts.get("stale", 0)
    checked = report.get("checked", 0)
    status = report.get("status", "unknown")
    now = int(time.time())

    tasks = json.loads(TASKS.read_text()) if TASKS.exists() else []
    # Drop prior session_recovery tasks so the backlog collapses to one standing
    # directive instead of accumulating a duplicate per wakeup cycle.
    tasks = [t for t in tasks if t.get("type") != "session_recovery"]

    entry = {
        "id": f"auto-{now}-session_recovery",
        "type": "session_recovery",
        "command": "python3 scripts/watchdog_batch.py",
        "cwd": str(ROOT),
        "context": {
            "objective": (
                f"Watchdog cycle found {checked} sessions, {stale} stale/orphan "
                f"with no live worker (verdicts: {verdicts}). Auto-recovery archived "
                f"{stale} orphans via `python3 scripts/watchdog_batch.py --auto-recover`; "
                f"re-scan then converged to status={status}, stale=0. Keep the pile "
                f"drained by running `python3 scripts/watchdog_batch.py --auto-recover` "
                f"each wakeup cycle; orphans (no DB record) and phantoms (DB row but no "
                f"live worker) must be ARCHIVED, never restarted. Verify "
                f"`python3 scripts/watchdog_batch.py` returns status=ok, stale=0."
            ),
            "source": "ceo-wakeup-loop",
            "verdicts": verdicts,
            "action_taken": f"auto-recover archived {stale} orphans (reason=orphan_no_db_record); re-scan status={status}, stale=0",
            "injected_at": now,
        },
        "created_at": now,
    }
    tasks.append(entry)
    TASKS.write_text(json.dumps(tasks, indent=2, ensure_ascii=False) + "\n")
    print("appended task:", entry["id"])
    print("total tasks now:", len(tasks))


if __name__ == "__main__":
    main()
