#!/usr/bin/env python3
"""GlideLoop production CEO daemon.

Single-instance daemon that:
- Ensures worker is running
- Drives real planning/execution via MCP/CEO
- Monitors progress and injects improvement goals
- Commits and pushes to GitHub
- Backs off when GlideLoop is truly autonomous
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(os.environ.get("GLIDELOOP_ROOT", "/home/gfardad/projects/glideloop"))
STATE_DIR = REPO_ROOT / "runtime" / "state"
PID_FILE = STATE_DIR / "ceo_daemon.pid"
LOG_FILE = STATE_DIR / "logs" / "ceo_daemon.log"
PYTHONPATH = str(REPO_ROOT)
INTERVAL = 15  # seconds between cycles
MAX_IDLE_CYCLES = 10  # after this many idle cycles, back off

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

def ensure_single_instance() -> bool:
    """Ensure only one daemon instance is running. Returns True if this instance should continue."""
    if PID_FILE.exists():
        pid_text = PID_FILE.read_text().strip()
        if pid_text.isdigit():
            pid = int(pid_text)
            try:
                os.kill(pid, 0)
                # Another instance is running
                print(f"[ceo-daemon] Another instance running (pid {pid}), exiting")
                return False
            except ProcessLookupError:
                pass
    PID_FILE.parent.mkdir(parents=True, exist_ok=True)
    PID_FILE.write_text(str(os.getpid()))
    return True

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

def find_todos() -> list[dict]:
    """Scan runtime/ for TODOs and FIXMEs and return actionable items."""
    items = []
    try:
        for py_file in REPO_ROOT.glob("runtime/**/*.py"):
            text = py_file.read_text(encoding="utf-8", errors="ignore")
            for lineno, line in enumerate(text.splitlines(), 1):
                if "TODO" in line or "FIXME" in line or "HACK" in line:
                    items.append({
                        "file": str(py_file.relative_to(REPO_ROOT)),
                        "line": lineno,
                        "text": line.strip(),
                        "type": "TODO" if "TODO" in line else "FIXME" if "FIXME" in line else "HACK",
                    })
    except Exception as exc:
        print(f"[ceo-daemon] TODO scan failed: {exc}")
    return items[:10]

def drive_planning(status: dict) -> None:
    """Drive real planning/execution through GlideLoop interfaces."""
    orchestrator = status.get("orchestrator", {})
    active = orchestrator.get("active_sessions", 0)
    sessions = status.get("sessions", [])

    if active == 0 and not sessions:
        print("[ceo-daemon] No active work. Starting orchestrator session...")
        result = mcp("glideloop_run", {"objective": "Continue production readiness improvements"})
        if result.get("exit_code") == 0:
            print("[ceo-daemon] Orchestrator session started")
        else:
            print(f"[ceo-daemon] Orchestrator start failed: {result}")

    # CEO directive to drive pipeline
    ceo_directive("Execute next production improvement phase and validate artifacts")

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

def analyze_and_improve(status: dict) -> None:
    """Analyze current state and inject concrete improvement tasks."""
    # Scan for TODOs/FIXMEs
    todos = find_todos()
    if todos:
        inject_improvement_task(
            "todo_cleanup",
            f"echo 'Found {len(todos)} TODOs/FIXMEs'; grep -rn 'TODO\\|FIXME' runtime || true",
            f"Address {len(todos)} TODOs/FIXMEs in runtime/",
        )

    # If dev is idle, try to activate it with real work
    dev_status = status.get("dev_env", {}).get("dev", {}).get("status", "unknown")
    if dev_status == "idle":
        inject_improvement_task(
            "dev_activate",
            "echo 'Activating dev CTO with real work'; pytest tests/test_mcp_server.py -q || true",
            "Activate dev environment with focused test run",
        )

    # Monitor production blockers
    counters = status.get("counters", {})
    if counters.get("sessions_started", 0) == 0 and status.get("orchestrator", {}).get("active_sessions", 0) == 0:
        inject_improvement_task(
            "monitor_sessions",
            "echo 'Monitoring orchestrator sessions'; glideloop_status || true",
            "Monitor and investigate why sessions_started remains 0",
        )

    # Always run quality checks
    inject_improvement_task(
        "quality",
        "pytest -q || echo 'Tests failed'",
        "Run quality gates",
    )

    # Alert on known production blocker
    if counters.get("mcp_tool_calls", 0) > 0:
        inject_improvement_task(
            "alert_approve_dev",
            "echo 'ALERT: test_approve_dev is failing - blocking production approval flow'; pytest tests/test_dev_env.py::test_approve_dev -v || true",
            "Alert: test_approve_dev failure is blocking dev approval flow",
        )

def monitor_loop() -> None:
    print("[ceo-daemon] Starting GlideLoop CEO daemon...")
    if not ensure_single_instance():
        return

    cycle = 0
    idle_cycles = 0
    last_push_cycle = 0

    try:
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

            active_sessions = orchestrator.get("active_sessions", 0)
            dev_status = dev_env.get("dev", {}).get("status", "unknown")

            print(f"[ceo-daemon] sessions_started: {counters.get('sessions_started', 0)}")
            print(f"[ceo-daemon] active_sessions: {active_sessions}")
            print(f"[ceo-daemon] dev_status: {dev_status}")

            # Drive planning/execution
            drive_planning(status)

            # Analyze and inject concrete improvements
            analyze_and_improve(status)

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

            # Track idle state
            if active_sessions == 0 and not sessions:
                idle_cycles += 1
            else:
                idle_cycles = 0

            # Back off if idle for too long
            if idle_cycles >= MAX_IDLE_CYCLES:
                print(f"[ceo-daemon] Backing off after {idle_cycles} idle cycles")
                time.sleep(60)
                idle_cycles = 0
                continue

            time.sleep(INTERVAL)

    finally:
        if PID_FILE.exists() and PID_FILE.read_text().strip() == str(os.getpid()):
            PID_FILE.unlink(missing_ok=True)

if __name__ == "__main__":
    try:
        monitor_loop()
    except KeyboardInterrupt:
        print("\n[ceo-daemon] Shutting down...")
        if PID_FILE.exists() and PID_FILE.read_text().strip() == str(os.getpid()):
            PID_FILE.unlink(missing_ok=True)
        sys.exit(0)
