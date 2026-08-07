"""Glideloop Orchestrator entrypoint."""

from __future__ import annotations

import sys

from .config import OrchestratorConfig

from runtime.logging import get_logger, log_event

__all__ = ["main"]

_LOGGER = get_logger("glideloop.main")


def main(argv: list[str] | None = None) -> int:
    config = OrchestratorConfig()
    if argv is None:
        argv = sys.argv[1:]
    if not argv:
        log_event(_LOGGER, "command_help", {"argv": argv})
        print(f"Glideloop Orchestrator root={config.root}")
        return 0
    if argv[0] == "run":
        from .session import Session
        from .state import OrchestratorState

        objective = argv[1] if len(argv) > 1 else "demo"
        log_event(_LOGGER, "session_start_requested", {"objective": objective})
        session = Session.start(objective=objective)
        state = OrchestratorState(db_path=config.state_dir / "glideloop_orchestrator.sqlite")
        conn = state.connect()
        conn.execute(
            "INSERT OR REPLACE INTO sessions (session_id, objective, mode, depth, target_agents, status, cwd) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (session.session_id, session.objective, session.mode, session.depth, session.target_agents, session.status, str(session.cwd)),
        )
        conn.commit()
        conn.close()
        state.close()
        log_event(_LOGGER, "session_started", {"session_id": session.session_id, "cwd": str(session.cwd)})
        print(f"started session={session.session_id} cwd={session.cwd}")
        return 0
    log_event(_LOGGER, "command_unknown", {"argv": argv})
    print(f"unknown command: {argv[0]}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
