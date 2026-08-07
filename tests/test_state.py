"""Tests for runtime state store."""

from __future__ import annotations

import os
import tempfile

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
