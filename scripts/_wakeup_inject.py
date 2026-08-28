"""Wakeup-loop injection of a session_recovery task reflecting the REAL event.

This is a thin, auditable injector used by the CEO wakeup loop. It does NOT
re-run the watchdog (the caller already ran scan -> --auto-recover -> re-scan);
instead it records the exact numbers observed this cycle so the backlog stays
truthful instead of collapsing to a hardcoded 0 or a fabricated "4 orphans".

Usage:
    python3 scripts/_wakeup_inject.py '<watchdog-report-json>'

The single positional argument is the JSON report produced by
``scripts/watchdog_batch.py`` (status + verdicts), captured by the caller.
The injection is idempotent per cycle: any prior session_recovery task is
dropped and replaced with one reflecting the current report, so the backlog
never accumulates duplicate recovery directives.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

ROOT = Path("/home/gfardad/projects/glideloop")
TASKS = ROOT / "runtime" / "state" / "tasks.json"

# Verdicts that represent work the auto-recover path can actually drain.
_STALE_VERDICTS = ("stale", "stuck", "dead", "zombie")


def count_stale(report: dict) -> int:
    verdicts = (report or {}).get("verdicts", {})
    return sum(verdicts.get(v, 0) for v in _STALE_VERDICTS)


def build_task(report: dict) -> dict:
    now = int(time.time())
    verdicts = report.get("verdicts", {})
    status = report.get("status", "unknown")
    checked = report.get("checked", 0)
    stale = count_stale(report)
    objective = (
        f"Watchdog cycle found {checked} sessions, {stale} stale/orphan needing "
        f"attention (verdicts: {verdicts}). Re-run `python3 scripts/watchdog_batch.py "
        f"--auto-recover` each wakeup cycle to keep the pile drained: orphans (no DB "
        f"record) and phantoms (DB row but no live worker) must be ARCHIVED, never "
        f"restarted. Verify `python3 scripts/watchdog_batch.py` returns status=ok, "
        f"stale=0. Last observed status={status}."
    )
    return {
        "id": f"auto-{now}-session_recovery",
        "type": "session_recovery",
        "command": "python3 scripts/watchdog_batch.py --auto-recover",
        "cwd": str(ROOT),
        "context": {
            "objective": objective,
            "source": "ceo-wakeup-loop",
            "verdicts": verdicts,
            "status": status,
            "checked": checked,
            "stale": stale,
            "injected_at": now,
        },
        "created_at": now,
    }


def main(argv: list[str]) -> int:
    if len(argv) < 1:
        print("usage: _wakeup_inject.py '<watchdog-report-json>'", file=sys.stderr)
        return 2
    try:
        report = json.loads(argv[0])
    except json.JSONDecodeError as exc:
        print(f"invalid watchdog report json: {exc}", file=sys.stderr)
        return 2

    tasks = json.loads(TASKS.read_text()) if TASKS.exists() else []
    tasks = [t for t in tasks if t.get("type") != "session_recovery"]
    tasks.append(build_task(report))
    TASKS.write_text(json.dumps(tasks, indent=2, ensure_ascii=False) + "\n")
    print("wrote task:", tasks[-1]["id"])
    print("total tasks:", len(tasks))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
