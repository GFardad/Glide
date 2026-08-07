"""Glideloop Orchestrator process manager."""

from __future__ import annotations

import os
import signal
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from runtime.logging import get_logger, log_event

__all__ = ["ProcessManager", "ProcessRecord"]

from .config import OrchestratorConfig

_CONFIG = OrchestratorConfig()
_LOGGER = get_logger("glideloop.processes")


@dataclass
class ProcessRecord:
    job_id: str
    session_id: str
    agent_id: str
    command: str | list[str]
    cwd: Path
    env_allowlist: list[str] = field(default_factory=list)
    process: Optional[subprocess.Popen] = field(default=None, repr=False)


class ProcessManager:
    def __init__(self) -> None:
        self._records: dict[str, ProcessRecord] = {}

    def spawn(self, record: ProcessRecord) -> None:
        allow = set(record.env_allowlist)
        env = {key: value for key, value in os.environ.items() if key in allow}
        popen = subprocess.Popen(
            record.command,
            cwd=str(record.cwd),
            env=env,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            start_new_session=True,
        )
        record.process = popen
        self._records[record.job_id] = record
        log_event(_LOGGER, "process_spawned", {"job_id": record.job_id, "command": record.command, "cwd": str(record.cwd), "agent_id": record.agent_id, "session_id": record.session_id})

    def stop(self, job_id: str) -> None:
        record = self._records.pop(job_id, None)
        if record is None or record.process is None:
            return
        try:
            os.killpg(os.getpgid(record.process.pid), signal.SIGTERM)
        except ProcessLookupError:
            pass
        record.process.wait(timeout=10)
        log_event(_LOGGER, "process_stopped", {"job_id": job_id, "name": record.job_id, "agent_id": record.agent_id, "session_id": record.session_id})
