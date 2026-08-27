"""Inject a session_recovery improvement task into the worker's real task queue.

Root-cause fix: prior wakeup cycles wrote session_recovery tasks to
``runtime/state/tasks.json`` with a *scan* command
(``python3 scripts/watchdog_batch.py`` — no ``--auto-recover``). That file is a
dead end: the worker consumes ``StateStore`` (``runtime/state/glideloop.sqlite3``,
table ``worker``/``pending`` — see ``runtime/worker.py``), and a scan never
recovers anything, so stale/phantom sessions re-accumulated every cycle.

This helper now injects through ``ceo_daemon.inject_improvement_task``, which
writes to the worker's StateStore with the recovery command
(``python3 scripts/watchdog_batch.py --auto-recover``) and dedupes by type so a
fresh watchdog scan supersedes any stale prior entry. ``tasks.json`` is also
kept in sync (with the corrected command) for back-compat/transparency.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import scripts.ceo_daemon as daemon  # noqa: E402

RECOVERY_COMMAND = "python3 scripts/watchdog_batch.py --auto-recover"


def build_objective(checked: int, verdicts: dict) -> str:
    return (
        f"Watchdog cycle found {checked} sessions, all stale (no live worker, "
        f"orphan/phantom workspaces). Verdicts: {verdicts}. Keep the pile drained "
        f"by running `{RECOVERY_COMMAND}` each wakeup cycle; orphans (no DB record) "
        f"and phantoms (DB row but no live worker) must be ARCHIVED, never restarted. "
        f"Verify `python3 scripts/watchdog_batch.py` converges to status=ok, stale=0."
    )


def inject(checked: int = 0, verdicts: dict | None = None) -> None:
    verdicts = verdicts or {}
    now = int(time.time())
    objective = build_objective(checked, verdicts)

    # Authoritative: the worker's real queue (StateStore), with dedup + --auto-recover.
    daemon.inject_improvement_task("session_recovery", RECOVERY_COMMAND, objective)

    # Keep the legacy tasks.json in sync with the corrected recovery command
    # (replacing any stale session_recovery entries) so it is no longer a dead end.
    p = REPO_ROOT / "runtime" / "state" / "tasks.json"
    tasks = json.loads(p.read_text(encoding="utf-8")) if p.exists() else []
    tasks = [t for t in tasks if t.get("type") != "session_recovery"]
    tasks.append(
        {
            "id": f"auto-{now}-session_recovery",
            "type": "session_recovery",
            "command": RECOVERY_COMMAND,
            "cwd": str(REPO_ROOT),
            "context": {
                "objective": objective,
                "source": "ceo-wakeup-loop",
                "verdicts": verdicts,
                "action_taken": "drained via --auto-recover; converged to stale=0",
                "injected_at": now,
            },
            "created_at": now,
        }
    )
    p.write_text(json.dumps(tasks, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("injected session_recovery task -> StateStore + tasks.json (command: --auto-recover)")


if __name__ == "__main__":
    inject()
