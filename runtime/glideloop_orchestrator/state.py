"""Glideloop Orchestrator SQLite state."""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field
from pathlib import Path
from threading import Lock
from typing import Optional

__all__ = ["OrchestratorState", "init_db"]

_DB_NAME = "glideloop_orchestrator.sqlite"

_TABLES = [
    """
    CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        objective TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'hybrid',
        depth INTEGER NOT NULL DEFAULT 3,
        target_agents INTEGER NOT NULL DEFAULT 20,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        pid INTEGER,
        cwd TEXT,
        metadata TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS agents (
        agent_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        team_id TEXT,
        parent_id TEXT,
        role TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'idle',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS jobs (
        job_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        command TEXT NOT NULL,
        env_allowlist TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'queued',
        started_at TEXT,
        finished_at TEXT,
        return_code INTEGER,
        stdout_path TEXT,
        stderr_path TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS events (
        event_id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        agent_id TEXT,
        level TEXT NOT NULL DEFAULT 'info',
        message TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
    """,
]


def init_db(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.row_factory = sqlite3.Row
    for stmt in _TABLES:
        conn.execute(stmt)
    conn.commit()
    return conn


@dataclass
class OrchestratorState:
    db_path: Path
    _conn: Optional[sqlite3.Connection] = field(default=None, repr=False)
    _lock: Lock = field(default_factory=Lock, repr=False)

    def connect(self) -> sqlite3.Connection:
        with self._lock:
            if self._conn is None:
                self._conn = init_db(self.db_path)
            return self._conn

    def close(self) -> None:
        with self._lock:
            if self._conn is not None:
                self._conn.close()
                self._conn = None
