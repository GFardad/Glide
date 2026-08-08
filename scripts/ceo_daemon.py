#!/usr/bin/env python3
"""GlideLoop production CEO daemon.

Single-instance daemon that:
- Ensures worker is running
- Drives real planning/execution via MCP/CEO phases
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

def drive_ceo_pipeline() -> dict:
    """Drive the CEO phase pipeline: spec -> plan -> build -> test -> review -> ship."""
    phase_tools = [
        ("ceo_spec", {"objective": "Self-improve GlideLoop production readiness"}),
        ("ceo_plan", {}),
        ("ceo_build", {}),
        ("ceo_test", {}),
        ("ceo_review", {}),
        ("ceo_ship", {}),
    ]
    
    results = {}
    current_spec_session = None
    
    for tool_name, args in phase_tools:
        if tool_name == "ceo_plan" and current_spec_session:
            args = {"spec_session_id": current_spec_session}
        elif tool_name == "ceo_build" and results.get("ceo_plan", {}).get("plan_session_id"):
            args = {"plan_session_id": results["ceo_plan"]["plan_session_id"]}
        elif tool_name == "ceo_test" and results.get("ceo_build", {}).get("build_session_id"):
            args = {"build_session_id": results["ceo_build"]["build_session_id"]}
        elif tool_name == "ceo_review" and results.get("ceo_test", {}).get("test_session_id"):
            args = {"test_session_id": results["ceo_test"]["test_session_id"]}
        elif tool_name == "ceo_ship" and results.get("ceo_review", {}).get("review_session_id"):
            args = {"review_session_id": results["ceo_review"]["review_session_id"]}
        
        result = mcp(tool_name, args)
        results[tool_name] = result
        
        if result.get("status") == "ok":
            print(f"[ceo-daemon] {tool_name} -> {result.get('session_id') or result.get('phase')}")
            if tool_name == "ceo_spec":
                current_spec_session = result.get("session_id")
        else:
            print(f"[ceo-daemon] {tool_name} failed: {result.get('detail')}")
            break
    
    return results

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
    venv_python = REPO_ROOT / ".venv" / "bin" / "python3"
    python = str(venv_python) if venv_python.exists() else sys.executable
    proc = run([python, "-m", "pytest", "-q", "--tb=no"])
    passed = proc.returncode == 0
    output = proc.stdout.strip()
    return {
        "passed": passed,
        "output": output[-500:] if output else "",
        "returncode": proc.returncode,
    }

def find_todos() -> list[dict]:
    """Scan runtime/ for TODOs and FIXMEs and return actionable items."""
    items = []
    try:
        for py_file in REPO_ROOT.glob("runtime/**/*.py"):
            text = py_file.read_text(encoding="utf-8", errors="ignore")
            for lineno, line in enumerate(text.splitlines(), 1):
                if "TODO" in line or "FIXME" in line or "HACK" in line:
                    # Skip lines that are just checking for TODOs
                    if any(skip in line for skip in ['if "TODO"', "if 'TODO'", 'if "FIXME"', "if 'FIXME'", 'detect_todo', '_detect_todo']):
                        continue
                    items.append({
                        "file": str(py_file.relative_to(REPO_ROOT)),
                        "line": lineno,
                        "text": line.strip(),
                        "type": "TODO" if "TODO" in line else "FIXME" if "FIXME" in line else "HACK",
                    })
    except Exception as exc:
        print(f"[ceo-daemon] TODO scan failed: {exc}")
    return items[:10]

def monitor_loop() -> None:
    print("[ceo-daemon] Starting GlideLoop CEO daemon...")
    if not ensure_single_instance():
        return

    cycle = 0
    idle_cycles = 0
    last_push_cycle = 0
    pipeline_phase = 0

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

            # Drive CEO pipeline
            if active_sessions == 0 and not sessions:
                print("[ceo-daemon] No active work. Driving CEO pipeline...")
                pipeline_results = drive_ceo_pipeline()
                if any(r.get("status") == "ok" for r in pipeline_results.values()):
                    print("[ceo-daemon] CEO pipeline advanced")
            
            # CEO directive
            ceo_directive("Continue production improvements and maintain quality gates")

            # Scan for TODOs
            todos = find_todos()
            if todos:
                inject_improvement_task(
                    "todo_cleanup",
                    f"echo 'Found {len(todos)} TODOs/FIXMEs'; find runtime -name '*.py' -print0 | xargs -0 grep -n 'TODO\\|FIXME' || true",
                    f"Address {len(todos)} TODOs/FIXMEs in runtime/",
                )

            # Quality task
            inject_improvement_task(
                "quality",
                "pytest -q || echo 'Tests failed'",
                "Run quality gates",
            )

            # Dev activation
            if dev_status == "idle":
                inject_improvement_task(
                    "dev_activate",
                    "echo 'Activating dev CTO'",
                    "Activate dev environment",
                )

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
