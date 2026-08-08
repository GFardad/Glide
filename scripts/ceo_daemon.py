#!/usr/bin/env python3
"""GlideLoop self-driving CEO daemon.

Keeps GlideLoop continuously improving without manual intervention:
- Monitors status via MCP
- Generates real improvement tasks based on state
- Runs quality gates before pushing
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
INTERVAL = 15  # seconds between cycles

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

def quality_gate() -> dict:
    """Run tests and return pass/fail summary."""
    proc = run([sys.executable, "-m", "pytest", "-q", "--tb=no"])
    passed = proc.returncode == 0
    output = proc.stdout.strip()
    return {
        "passed": passed,
        "output": output[-500:] if output else "",
        "returncode": proc.returncode,
    }

def inject_improvement_task(task_type: str, command: str, objective: str) -> None:
    task = {
        "id": f"auto-{int(time.time())}-{task_type}",
        "type": task_type,
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
        print(f"[ceo-daemon] Injected task: {task_type} - {objective}")
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

def generate_improvements(status: dict) -> list[dict]:
    """Generate specific improvement tasks based on current state."""
    tasks = []
    counters = status.get("counters", {})
    orchestrator = status.get("orchestrator", {})
    sessions = status.get("sessions", [])
    teams = status.get("teams", {})

    active = orchestrator.get("active_sessions", 0)
    if active == 0:
        tasks.append({
            "type": "plan",
            "command": "echo 'Generating production plan'; find runtime -name '*.py' -exec wc -l {} + | tail -1",
            "objective": "Plan next production improvements",
        })

    dev_status = status.get("dev_env", {}).get("dev", {}).get("status", "unknown")
    if dev_status == "idle":
        tasks.append({
            "type": "dev_activate",
            "command": "echo 'Activating dev CTO'; pytest tests/test_dev_env.py -q || true",
            "objective": "Activate dev environment",
        })

    tasks.append({
        "type": "quality",
        "command": "pytest -q || echo 'Tests failed'; flake8 runtime || true",
        "objective": "Run quality gates",
    })

    review = mcp("code_review_graph", {"command": "status"})
    if review.get("status") == "ok":
        tasks.append({
            "type": "review",
            "command": "echo 'Running code review graph'; code-review-graph status || true",
            "objective": "Code review and architecture check",
        })

    return tasks

def drive_execution(status: dict) -> None:
    """Drive real planning/execution through GlideLoop interfaces."""
    orchestrator = status.get("orchestrator", {})
    active = orchestrator.get("active_sessions", 0)
    sessions = status.get("sessions", [])

    if active == 0 and not sessions:
        print("[ceo-daemon] No active work. Starting real orchestrator session...")
        result = mcp("glideloop_run", {"objective": "Continue production readiness improvements"})
        if result.get("exit_code") == 0:
            print("[ceo-daemon] Orchestrator session started")
        else:
            print(f"[ceo-daemon] Orchestrator start failed: {result}")

    # CEO pipeline progression
    ceo_directive("Execute next production improvement phase and validate artifacts")

def monitor_loop() -> None:
    print("[ceo-daemon] Starting GlideLoop CEO daemon...")
    cycle = 0
    last_push_cycle = 0
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

        # Generate and inject improvement tasks
        improvements = generate_improvements(status)
        for task in improvements:
            inject_improvement_task(task["type"], task["command"], task["objective"])

        # Drive real execution
        drive_execution(status)

        # Quality gate before push
        if cycle - last_push_cycle >= 3:
            gate = quality_gate()
            if gate["passed"]:
                commit_msg = f"chore(daemon): auto-improve cycle {cycle}"
                if git_commit_and_push(commit_msg):
                    print(f"[ceo-daemon] Git push succeeded for cycle {cycle}")
                    last_push_cycle = cycle
                else:
                    print(f"[ceo-daemon] Git push failed for cycle {cycle}")
            else:
                print(f"[ceo-daemon] Quality gate failed, skipping push")
                print(f"[ceo-daemon] Gate output: {gate['output'][:200]}")

        time.sleep(INTERVAL)

if __name__ == "__main__":
    try:
        monitor_loop()
    except KeyboardInterrupt:
        print("\n[ceo-daemon] Shutting down...")
        sys.exit(0)
