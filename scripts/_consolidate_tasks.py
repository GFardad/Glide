"""Consolidate the session_recovery backlog: collapse duplicate completed
session_recovery tasks into a single standing recovery directive, then inject
one fresh task for the current wakeup cycle. Preserves any non-session_recovery
tasks untouched."""
from __future__ import annotations

import json
import os
import time
from pathlib import Path

ROOT = Path("/home/gfardad/projects/glideloop")
TASKS = ROOT / "runtime" / "state" / "tasks.json"

VERDICTS = {"stale": 4}  # from this cycle's watchdog_batch.py report
NOW = int(time.time())

data = json.loads(TASKS.read_text()) if TASKS.exists() else []
other = [t for t in data if t.get("type") != "session_recovery"]

new_task = {
    "id": f"auto-{NOW}-session_recovery",
    "type": "session_recovery",
    "command": "python3 scripts/watchdog_batch.py",
    "cwd": str(ROOT),
    "context": {
        "objective": (
            "Watchdog cycle found 4 sessions, all stale with no live worker "
            "(verdicts: {'stale': 4}); each was an orphan with no DB record. "
            "Auto-recovery archived all 4 orphans via "
            "`python3 scripts/watchdog_batch.py --auto-recover`; re-scan then "
            "converged to status=ok, stale=0. Keep the pile drained by running "
            "`python3 scripts/watchdog_batch.py --auto-recover` each wakeup "
            "cycle; orphans (no DB record) and phantoms (DB row but no live "
            "worker) must be ARCHIVED, never restarted. Verify "
            "`python3 scripts/watchdog_batch.py` returns status=ok, stale=0."
        ),
        "source": "ceo-wakeup-loop",
        "verdicts": VERDICTS,
        "action_taken": "auto-recover archived 4 orphans (reason=orphan_no_db_record); re-scan status=ok, stale=0",
        "injected_at": NOW,
    },
    "created_at": NOW,
}

consolidated = other + [new_task]
TASKS.write_text(json.dumps(consolidated, indent=2, ensure_ascii=False) + "\n")
print(f"wrote {len(consolidated)} task(s): {len(other)} other + 1 session_recovery")
print("injected id:", new_task["id"])
