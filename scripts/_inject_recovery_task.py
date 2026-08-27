"""Inject a session_recovery improvement task into runtime/state/tasks.json."""
import json
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
p = ROOT / "runtime" / "state" / "tasks.json"
tasks = json.loads(p.read_text())
now = int(time.time())
entry = {
    "id": f"auto-{now}-session_recovery",
    "type": "session_recovery",
    "command": "python3 scripts/watchdog_batch.py",
    "cwd": str(ROOT),
    "context": {
        "objective": (
            "Watchdog cycle found 4 sessions, all stale with no live worker "
            "(verdicts: {'stale': 4}); each was an orphan with no DB record. "
            "Auto-recovery archived all 4 orphans via `python3 scripts/watchdog_batch.py --auto-recover`; "
            "re-scan then converged to status=ok, stale=0. Keep the pile drained by running "
            "`python3 scripts/watchdog_batch.py --auto-recover` each wakeup cycle; orphans (no DB record) "
            "and phantoms (DB row but no live worker) must be ARCHIVED, never restarted. "
            "Verify `python3 scripts/watchdog_batch.py` returns status=ok, stale=0."
        ),
        "source": "ceo-wakeup-loop",
        "verdicts": {"stale": 4},
        "action_taken": "auto-recover archived 4 orphans (reason=orphan_no_db_record); re-scan status=ok, stale=0",
        "injected_at": now,
    },
    "created_at": now,
}
tasks.append(entry)
p.write_text(json.dumps(tasks, indent=2, ensure_ascii=False) + "\n")
print("appended task:", entry["id"])
print("total tasks now:", len(tasks))
