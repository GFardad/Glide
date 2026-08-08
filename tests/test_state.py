"""Tests for runtime state store."""

from __future__ import annotations

import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import pytest

from runtime.state import StateStore


def test_state_store_set_get_and_delete():
    with tempfile.TemporaryDirectory() as tmp:
        store = StateStore(Path(tmp))
        store.set("users", "alice", {"role": "admin"})
        assert store.get("users", "alice") == {"role": "admin"}
        store.delete("users", "alice")
        assert store.get("users", "alice") is None


def test_state_store_list_table():
    with tempfile.TemporaryDirectory() as tmp:
        store = StateStore(Path(tmp))
        store.set("teams", "web", {"lead": "alice"})
        store.set("teams", "api", {"lead": "bob"})
        assert store.list_table("teams") == {"web": {"lead": "alice"}, "api": {"lead": "bob"}}


def test_state_store_ttl_expires():
    with tempfile.TemporaryDirectory() as tmp:
        store = StateStore(Path(tmp))
        store.set("token", "x", {"value": 1}, ttl_seconds=0)
        assert store.get("token", "x") is None


def test_state_store_get_corrupted_json():
    with tempfile.TemporaryDirectory() as tmp:
        store = StateStore(Path(tmp))
        store._conn.execute(
            "INSERT INTO records (table_name, key, value, ttl_seconds, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
            ("users", "alice", "not-valid-json{{{", None, datetime.now(timezone.utc).isoformat(), None),
        )
        store._conn.commit()
        assert store.get("users", "alice") is None


def test_state_store_list_table_corrupted_json():
    with tempfile.TemporaryDirectory() as tmp:
        store = StateStore(Path(tmp))
        store.set("teams", "web", {"lead": "alice"})
        store._conn.execute(
            "INSERT INTO records (table_name, key, value, ttl_seconds, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
            ("teams", "api", "corrupted!!!", None, datetime.now(timezone.utc).isoformat(), None),
        )
        store._conn.commit()
        result = store.list_table("teams")
        assert result == {"web": {"lead": "alice"}}
