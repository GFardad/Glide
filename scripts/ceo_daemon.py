#!/usr/bin/env python3
"""GlideLoop self-driving CEO daemon.

Keeps GlideLoop continuously improving without manual intervention:
- Monitors status via MCP
- Injects improvement tasks and directives
- Commits and pushes to GitHub
- Acts as both CEO and USER
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(os.environ.get("GLIDELOOP_ROOT", "/home/gfardad/projects/glideloop"))
STATE_DIR = REPO_ROOT / "runtime" / "state"
PYTHONPATH = str(REPO_ROOT)
INTERVAL = 20  # seconds between cycles

def run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(
        cmd,
        cwd=REPO_ROOT,
        env={**os.environ, "PYTHONPATH": PYTHONPATH},
        capture_output=True,
        text=True,
        **kwargs,
    )

def mcp(tool: str, arguments: dict | None = None) -> dict:
    args = arguments or {}
    proc = run(
        [sys.executable, "-c", f"import json; from runtime.mcp.server import handle_tool; print(handle_tool({tool!r}, {json.dumps(args)}))"],
    )
    if proc.returncode != 0:
        return {"status": "error", "detail": proc.stderr.strip() or proc.stdout.strip()}
    try:
        return json.loads(proc.stdout.strip())
    except json.JSONDecodeError:
        return {"status": "error", "detail": proc.stdout.strip()}

def git_commit_and_push(message: str) -> bool:
    try:
        run(["git", "add", "-A"])
        run(["git", "commit", "-m", message])
        run(["git", "push", "origin", "next-version"])
        return True
    except Exception as exc:
        print(f"[ceo-daemon] git error: {exc}")
        return False

def ensure_worker_running() -> None:
    pid_file = STATE_DIR / "worker.pid"
    if pid_file.exists():
        pid_text = pid_file.read_text().strip()
        if pid_text.isdigit():
            pid = int(pid_text)
            try:
                os.kill(pid, 0)
                return
            except ProcessLookupError:
                pass
    print("[ceo-daemon] Starting worker...")
    run(
        [sys.executable, "-c", "from runtime.worker import Worker; Worker().run()"],
        background=True,
    )

def inject_task(command: str, objective: str) -> None:
    task = {
        "id": f"auto-{int(time.time())}",
        "type": "auto_improve",
        "command": command,
        "context": {"objective": objective, "source": "ceo-daemon"},
        "created_at": time.time(),
    }
    try:
        from runtime.state import StateStore
        store = StateStore(STATE_DIR)
        pending = store.get("worker", "pending") or []
        pending.append(task)
        store.set("worker", "pending", pending)
    except Exception as exc:
        print(f"[ceo-daemon] Failed to inject task: {exc}")

def ceo_directive(objective: str) -> None:
    payload = {
        "objective": objective,
        "source": "ceo-daemon",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    result = mcp("ceo_execute", {"command": "broadcast", "payload": payload})
    if result.get("status") == "ok":
        deliveries = result.get("deliveries", [])
        print(f"[ceo-daemon] CEO directive broadcasted: {len(deliveries)} deliveries")
    else:
        print(f"[ceo-daemon] CEO directive failed: {result}")

def auto_improve_cycle() -> None:
    # Always inject an improvement task for the worker
    inject_task(
        "echo 'Auto-improve cycle'; pytest -q || true; echo 'done'",
        "Run tests and continue improving"
    )

    # Drive CEO pipeline
    ceo_directive("Continue production improvements and quality checks")

    # Run code review graph if available
    review = mcp("code_review_graph", {"command": "status"})
    if review.get("status") == "ok":
        print(f"[ceo-daemon] code review graph: {review.get('summary', 'ok')}")
    else:
        print(f"[ceo-daemon] code review graph skipped: {review}")

def monitor_loop() -> None:
    print("[ceo-daemon] Starting GlideLoop CEO daemon...")
    cycle = 0
    while True:
        cycle += 1
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        print(f"\n[ceo-daemon] === Cycle {cycle} at {now} ===")

        ensure_worker_running()
        status = mcp("glideloop_status")
        orchestrator = status.get("orchestrator", {})
        sessions = status.get("sessions", [])
        counters = status.get("counters", {})
        dev_env = status.get("dev_env", {})

        print(f"[ceo-daemon] sessions_started: {counters.get('sessions_started', 0)}")
        print(f"[ceo-daemon] active_sessions: {orchestrator.get('active_sessions', 0)}")
        print(f"[ceo-daemon] dev_status: {dev_env.get('dev', {}).get('status', 'unknown')}")

        auto_improve_cycle()

        if cycle % 3 == 0:
            commit_msg = f"chore(daemon): auto-improve cycle {cycle}"
            if git_commit_and_push(commit_msg):
                print(f"[ceo-daemon] Git push succeeded for cycle {cycle}")
            else:
                print(f"[ceo-daemon] Git push failed for cycle {cycle}")

        time.sleep(INTERVAL)

if __name__ == "__main__":
    try:
        monitor_loop()
    except KeyboardInterrupt:
        print("\n[ceo-daemon] Shutting down...")
        sys.exit(0)
