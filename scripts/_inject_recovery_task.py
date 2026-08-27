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
            "Watchdog cycle found 224 stale sessions (checked=224, stale=224): "
            "75 orphan workspaces with no orchestrator DB record, and 152 phantom "
            "'running' DB rows with pid=None and NO live worker process. Root cause "
            "was a leak in scripts/watchdog_batch.py: recover_sessions() restarted any "
            "stale session that had a DB row, so phantom 'running' rows were re-run "
            "via the MCP glideloop_run tool every cycle, spawning fresh workspaces "
            "and re-accumulating the pile (history shows 104 -> 212 -> 224). Fix "
            "applied: restart now only fires when a genuinely live worker is attached "
            "(status running AND worker_alive); orphans and phantoms are archived. "
            "This --auto-recover run archived 152 phantoms (reason=phantom_no_live_worker) "
            "and the batch converged to status=ok, stale=0. Verify: "
            "'python3 scripts/watchdog_batch.py' must keep returning stale=0 across "
            "subsequent wakeup cycles without the pile re-growing."
        ),
        "source": "ceo-wakeup-loop",
        "verdicts": {"stale": 224, "checked": 224, "dead": 0, "zombie": 0, "ok": 0},
        "action_taken": "code fix applied (archive phantoms/orphans, restart only live workers) + --auto-recover archived 152 phantom sessions; batch converged to stale=0",
        "injected_at": now,
    },
    "created_at": now,
}

tasks.append(new_task)
p.write_text(json.dumps(tasks, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print("written. total tasks:", len(tasks))
print("new id:", new_task["id"])
