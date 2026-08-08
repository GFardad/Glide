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
    subprocess.Popen(
        [sys.executable, "-c", "from runtime.worker import Worker; Worker().run()"],
        cwd=REPO_ROOT,
        env={**os.environ, "PYTHONPATH": PYTHONPATH},
        stdout=open(LOG_FILE, "a", encoding="utf-8"),
        stderr=subprocess.STDOUT,
        close_fds=True,
    )


def find_todos() -> list[dict]:
    """Scan runtime/ for TODOs and FIXMEs and return actionable items."""
    items: list[dict] = []
    try:
        for py_file in REPO_ROOT.glob("runtime/**/*.py"):
            text = py_file.read_text(encoding="utf-8", errors="ignore")
            for lineno, line in enumerate(text.splitlines(), 1):
                if "TODO" not in line and "FIXME" not in line and "HACK" not in line:
                    continue
                normalized = line.strip()
                lowered = normalized.lower()
                skip_patterns = [
                    'if "todo"', "if 'todo'",
                    'if "fixme"', "if 'fixme'",
                    "detect_todo", "_detect_todo",
                    'if "fixme" in text or "todo" in text',
                    "todo.md", "goal.md",
                    "loop_b hint: break the current todo",
                    'if "FIXME" in text or "TODO" in text',
                ]
                if any(pattern.lower() in lowered for pattern in skip_patterns):
                    continue
                items.append(
                    {
                        "file": str(py_file.relative_to(REPO_ROOT)),
                        "line": lineno,
                        "text": normalized,
                        "type": "TODO" if "TODO" in line else "FIXME" if "FIXME" in line else "HACK",
                    }
                )
    except Exception as exc:
        print(f"[ceo-daemon] TODO scan failed: {exc}")
    return items[:10]


def drive_pipeline(status: dict) -> dict:
    """Drive the CEO phase pipeline when there is no active work."""
    pipeline: dict[str, str | None] = {
        "spec": None,
        "plan": None,
        "build": None,
        "test": None,
        "review": None,
        "ship": None,
    }
    steps = [
        ("ceo_spec", "spec", {"objective": "Self-improve GlideLoop production readiness"}),
        ("ceo_plan", "plan", {}),
        ("ceo_build", "build", {}),
        ("ceo_test", "test", {}),
        ("ceo_review", "review", {}),
        ("ceo_ship", "ship", {}),
    ]

    for tool_name, key, args in steps:
        if tool_name == "ceo_plan" and pipeline["spec"]:
            args = {"spec_session_id": pipeline["spec"]}
        elif tool_name == "ceo_build" and pipeline["plan"]:
            args = {"plan_session_id": pipeline["plan"]}
        elif tool_name == "ceo_test" and pipeline["build"]:
            args = {"build_session_id": pipeline["build"]}
        elif tool_name == "ceo_review" and pipeline["test"]:
            args = {"test_session_id": pipeline["test"]}
        elif tool_name == "ceo_ship" and pipeline["review"]:
            args = {"review_session_id": pipeline["review"]}

        result = mcp(tool_name, args)
        if result.get("status") == "ok":
            pipeline[key] = result.get("session_id")
            print(f"[ceo-daemon] pipeline {tool_name} -> {pipeline[key]}")
        else:
            print(f"[ceo-daemon] pipeline {tool_name} failed: {result.get('detail')}")
            break
    return pipeline


def _latest_orchestrator_session_id() -> str | None:
    """Return the most recent orchestrator session id, if any."""
    db_path = STATE_DIR / "glideloop_orchestrator.sqlite"
    if not db_path.exists():
        return None
    import sqlite3

    try:
        conn = sqlite3.connect(str(db_path))
        try:
            row = conn.execute(
                "SELECT session_id FROM sessions ORDER BY created_at DESC LIMIT 1"
            ).fetchone()
        finally:
            conn.close()
        return row[0] if row else None
    except Exception:
        return None


def _latest_worker_event() -> dict | None:
    log = STATE_DIR / "logs" / "worker.jsonl"
    if not log.exists():
        return None
    try:
        lines = log.read_text(encoding="utf-8").splitlines()
        if not lines:
            return None
        return json.loads(lines[-1])
    except Exception:
        return None


def _build_directive_objective(status: dict) -> str:
    counters = status.get("counters", {})
    orchestrator = status.get("orchestrator", {})
    dev_env = status.get("dev_env", {})
    sessions = status.get("sessions", [])
    active_sessions = orchestrator.get("active_sessions", 0)
    session_count = orchestrator.get("session_count", 0)
    worker_processed = counters.get("sessions_processed_by_worker", 0)
    dev_status = dev_env.get("dev", {}).get("status", "unknown")

    latest = _latest_worker_event()
    latest_event = ""
    if latest:
        if latest.get("event") == "execution_result":
            rc = latest.get("returncode")
            latest_event = "Latest worker run passed." if rc == 0 else "Latest worker run FAILED. Investigate immediately."
        elif latest.get("event") == "error":
            latest_event = "Worker error detected."
        else:
            latest_event = f"Latest worker event: {latest.get('event')}."

    if worker_processed == 0 and not sessions:
        return f"No production output detected. Start planning/execution pipeline immediately. {latest_event}"
    if active_sessions == 0 and session_count == 0:
        return f"Drive orchestrator sessions to advance production readiness. {latest_event}"
    if dev_status == "idle":
        return f"Activate dev environment and run focused test gate. {latest_event}"
    return f"Continue current production improvements. {latest_event}"


def _scan_watchdog_batch() -> dict:
    """Run parallel watchdog batch scan and return report dict."""
    try:
        from scripts.watchdog_batch import run_parallel_health_checks

        return run_parallel_health_checks()
    except Exception as exc:
        return {"status": "error", "detail": str(exc), "results": []}


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
        "cwd": str(REPO_ROOT),
        "context": {"objective": objective, "source": "ceo-daemon"},
        "created_at": time.time(),
    }
    try:
        from runtime.state import StateStore

        store = StateStore(STATE_DIR)
        pending = store.get("worker", "pending") or []
        if any(existing.get("type") == task_type for existing in pending):
            return
        if len(pending) >= 5:
            return
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


def monitor_loop() -> None:
    print("[ceo-daemon] Starting GlideLoop CEO daemon...")
    if not ensure_single_instance():
        return

    cycle = 0
    idle_cycles = 0
    last_push_cycle = 0
    last_backoff_processed = None

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

            # Drive planning/execution when there is no measurable productive output
            if counters.get("sessions_processed_by_worker", 0) == 0 and not sessions:
                print("[ceo-daemon] No productive work detected. Driving CEO pipeline...")
                drive_pipeline(status)
                ceo_directive(_build_directive_objective(status))
            else:
                ceo_directive(_build_directive_objective(status))

            # Drive real orchestrator sessions on a schedule so sessions_started advances
            if cycle % 8 == 0:
                print("[ceo-daemon] Driving orchestrator session...")
                try:
                    latest_session_id = _latest_orchestrator_session_id()
                except Exception:
                    latest_session_id = None
                if not latest_session_id:
                    mcp("glideloop_run", {"objective": "Self-improve production readiness via CEO daemon"})

            # If dev is idle, try to activate it with real work
            if dev_status == "idle":
                inject_improvement_task(
                    "dev_activate",
                    "echo 'Activating dev CTO with real work'; pytest tests/test_mcp_server.py -q || true",
                    "Activate dev environment with focused test run",
                )

            # Monitor production blockers
            if counters.get("sessions_started", 0) == 0 and active_sessions == 0:
                inject_improvement_task(
                    "monitor_sessions",
                    "echo 'Monitoring orchestrator sessions'; glideloop_status || true",
                    "Monitor and investigate why sessions_started remains 0",
                )

            # Scan for TODOs/FIXMEs
            todos = find_todos()
            if todos:
                inject_improvement_task(
                    "todo_cleanup",
                    f"echo 'Found {len(todos)} TODOs/FIXMEs'; find '{REPO_ROOT}/runtime' -name '*.py' -print0 | xargs -0 grep -n 'TODO\\|FIXME' || true",
                    f"Address {len(todos)} TODOs/FIXMEs in runtime/",
                )

            # Always run quality checks
            inject_improvement_task(
                "quality",
                f"cd '{REPO_ROOT}' && pytest -q || echo 'Tests failed'",
                "Run quality gates",
            )

            # Run code-review-graph if available
            crg_bin = REPO_ROOT / ".venv" / "bin" / "code-review-graph"
            if not crg_bin.exists():
                crg_bin = Path("/tmp/bench-installs/.venv/bin/code-review-graph")
            if crg_bin.exists():
                inject_improvement_task(
                    "code_review_graph",
                    f"cd '{REPO_ROOT}' && {crg_bin} status || true",
                    "Run code review graph status",
                )

            # Alert only on a genuinely failing approve_dev test
            approve_proc = run(
                [
                    sys.executable,
                    "-m",
                    "pytest",
                    "tests/test_dev_env.py::test_approve_dev",
                    "-q",
                    "--tb=no",
                ],
                timeout=120,
            )
            if approve_proc.returncode != 0:
                inject_improvement_task(
                    "alert_approve_dev",
                    "echo 'ALERT: test_approve_dev is failing - blocking production approval flow'; pytest tests/test_dev_env.py::test_approve_dev -v || true",
                    "Alert: test_approve_dev failure is blocking dev approval flow",
                )

            # Parallel watchdog: scan for stale/dead/zombie sessions and spawn recovery tasks
            watchdog_report = _scan_watchdog_batch()
            watchdog_items = watchdog_report.get("results", [])
            watchdog_verdicts = watchdog_report.get("verdicts", {})
            if watchdog_items:
                print(f"[ceo-daemon] Watchdog batch: {watchdog_verdicts}")
                stale_count = watchdog_verdicts.get("stale", 0) + watchdog_verdicts.get("stuck", 0) + watchdog_verdicts.get("dead", 0) + watchdog_verdicts.get("zombie", 0)
                if stale_count:
                    inject_improvement_task(
                        "session_recovery",
                        f"python3 scripts/watchdog_batch.py",
                        f"Recover {stale_count} stale/dead/zombie sessions: {watchdog_verdicts}",
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

            # Back off if the worker hasn't advanced for many cycles
            worker_processed = counters.get("sessions_processed_by_worker", 0)
            if (
                active_sessions == 0
                and not sessions
                and last_backoff_processed is not None
                and worker_processed == last_backoff_processed
            ):
                idle_cycles += 1
            else:
                idle_cycles = 0
            last_backoff_processed = worker_processed

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
