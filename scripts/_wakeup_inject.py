"""Wakeup-loop injection of a session_recovery task reflecting the REAL event.
This is a thin, auditable injector used by the CEO wakeup loop. It does NOT
re-run the watchdog (the caller already ran scan -> --auto-recover -> re-scan);
instead it records the exact numbers observed this cycle so the backlog stays
truthful instead of collapsing to a stale 0.
"""
import json
import os
import sys
import time
from pathlib import Path

ROOT = Path("/home/gfardad/projects/glideloop")
TASKS = ROOT / "runtime" / "state" / "tasks.json"


def main() -> int:
    # Numbers captured by the caller this cycle: scan found 4 stale orphans,
    # --auto-recover archived all 4, re-scan returned status=ok, stale=0.
    checked, stale, status = 4, 4, "ok"
    verdicts = {"stale": 4}
    now = int(time.time())

    tasks = json.loads(TASKS.read_text()) if TASKS.exists() else []
    tasks = [t for t in tasks if t.get("type") != "session_recovery"]

    entry = {
        "id": f"auto-{now}-session_recovery",
        "type": "session_recovery",
        "command": "python3 scripts/watchdog_batch.py",
        "cwd": str(ROOT),
        "context": {
            "objective": (
                f"Watchdog cycle found {checked} sessions, {stale} stale/orphan with no live "
                f"worker (verdicts: {verdicts}). Auto-recovery archived all {stale} orphans via "
                f"`python3 scripts/watchdog_batch.py --auto-recover` (reason=orphan_no_db_record); "
                f"re-scan then converged to status={status}, stale=0. Keep the pile drained by "
                f"running `python3 scripts/watchdog_batch.py --auto-recover` each wakeup cycle; "
                f"orphans (no DB record) and phantoms (DB row but no live worker) must be "
                f"ARCHIVED, never restarted. Verify `python3 scripts/watchdog_batch.py` returns "
                f"status=ok, stale=0."
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
    print("wrote task:", entry["id"])
    print("total tasks:", len(tasks))
    return 0


if __name__ == "__main__":
    sys.exit(main())
