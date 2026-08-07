"""Glideloop persistent state store with TTL cleanup."""

from __future__ import annotations

import json
import os
import sqlite3
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

__all__ = ["StateStore"]


@dataclass(frozen=True)
class StateRecord:
    table: str
    key: str
    value: Any
    ttl_seconds: Optional[int] = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    expires_at: Optional[str] = None


class StateStore:
    """SQLite-backed state store with TTL cleanup."""

    def __init__(self, state_dir: Optional[Path] = None) -> None:
        if state_dir is None:
            state_dir = Path(os.environ.get("GLIDELOOP_STATE", "/tmp/glideloop-state"))
        state_dir.mkdir(parents=True, exist_ok=True)
        self.db_path = state_dir / "glideloop.sqlite3"
        self._conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._lock = threading.Lock()
        self._init_db()
        self._cleanup_expired()

    def _init_db(self) -> None:
        with self._conn:
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS records (
                    table_name TEXT NOT NULL,
                    key TEXT NOT NULL,
                    value TEXT NOT NULL,
                    ttl_seconds INTEGER,
                    created_at TEXT NOT NULL,
                    expires_at TEXT,
                    PRIMARY KEY (table_name, key)
                )
                """
            )

    def _cleanup_expired(self) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self._conn:
            self._conn.execute("DELETE FROM records WHERE expires_at IS NOT NULL AND expires_at <= ?", (now,))

    def set(self, table: str, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        expires_at = None
        if ttl_seconds is not None:
            expires_at = datetime.fromtimestamp(
                datetime.now(timezone.utc).timestamp() + ttl_seconds,
                tz=timezone.utc,
            ).isoformat()
        with self._lock:
            self._cleanup_expired()
            with self._conn:
                self._conn.execute(
                    """
                    INSERT OR REPLACE INTO records (table_name, key, value, ttl_seconds, created_at, expires_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (table, key, json.dumps(value, ensure_ascii=False), ttl_seconds, datetime.now(timezone.utc).isoformat(), expires_at),
                )

    def get(self, table: str, key: str) -> Optional[Any]:
        with self._lock:
            self._cleanup_expired()
            row = self._conn.execute("SELECT value FROM records WHERE table_name = ? AND key = ?", (table, key)).fetchone()
            if row is None:
                return None
            return json.loads(row["value"])

    def delete(self, table: str, key: str) -> None:
        with self._lock:
            with self._conn:
                self._conn.execute("DELETE FROM records WHERE table_name = ? AND key = ?", (table, key))

    def list_table(self, table: str) -> dict[str, Any]:
        with self._lock:
            self._cleanup_expired()
            rows = self._conn.execute("SELECT key, value FROM records WHERE table_name = ?", (table,)).fetchall()
            return {row["key"]: json.loads(row["value"]) for row in rows}

    def clear(self) -> None:
        with self._lock:
            with self._conn:
                self._conn.execute("DELETE FROM records")

    def metrics(self) -> dict[str, Any]:
        with self._lock:
            total = self._conn.execute("SELECT COUNT(*) FROM records").fetchone()[0]
            expired = self._conn.execute("SELECT COUNT(*) FROM records WHERE expires_at IS NOT NULL").fetchone()[0]
            return {"records": total, "expired": expired}
