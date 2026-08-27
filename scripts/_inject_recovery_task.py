import json, time
from pathlib import Path

p = Path("runtime/state/tasks.json")
tasks = json.loads(p.read_text(encoding="utf-8")) if p.exists() else []
now = int(time.time())

new_task = {
    "id": f"auto-{now}-session_recovery",
    "type": "session_recovery",
    "command": "python3 scripts/watchdog_batch.py",
    "cwd": "/home/gfardad/projects/glideloop",
    "context": {
        "objective": (
            "Watchdog cycle found 104 stale sessions (all checked=104, stale=104), "
            "every one flagged 'session >15min with no log file'. auto-recover restarted "
            "all 104 via the MCP glideloop_run tool (exit_code 0, started=true) but the "
            "staleness reappears next cycle because the root cause is unlogged workspaces "
            "with old mtimes accumulating in runtime/workspace. Improvement: add a persistent "
            "auto-guard so any workspace without a heartbeat log older than 15min is archived "
            "automatically each wakeup (and cleaned from the parallel health check), preventing "
            "re-accumulation of hundreds of stale entries and keeping watchdog_batch cheap. "
            "Verify with 'watchdog_batch.py' returning stale=0."
        ),
        "source": "ceo-wakeup-loop",
        "verdicts": {"stale": 104, "checked": 104, "dead": 0, "zombie": 0},
        "action_taken": "auto-recover executed this cycle (all 104 stale sessions restarted)",
        "injected_at": now,
    },
    "created_at": now,
}

tasks.append(new_task)
p.write_text(json.dumps(tasks, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print("written. total tasks:", len(tasks))
print("new id:", new_task["id"])
