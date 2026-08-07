"""Tests for runtime structured logging."""

from __future__ import annotations

import json
import logging
import os
import tempfile
from pathlib import Path

import pytest

from runtime.logging import get_logger, log_event


def test_logger_writes_jsonl(tmp_path):
    logger = get_logger("test", log_dir=str(tmp_path))
    log_event(logger, "test_event", {"key": "value"})
    log_file = tmp_path / "glideloop.jsonl"
    assert log_file.exists()
    lines = [line for line in log_file.read_text(encoding="utf-8").splitlines() if line.strip()]
    assert len(lines) == 1
    payload = json.loads(lines[0])
    assert payload["message"] == "test_event"
    assert payload["level"] == "INFO"
    assert payload["payload"] == {"key": "value"}


def test_logger_creates_directory(tmp_path):
    log_dir = tmp_path / "nested" / "logs"
    logger = get_logger("test2", log_dir=str(log_dir))
    log_event(logger, "dir_event", {})
    assert log_dir.exists()
    assert (log_dir / "glideloop.jsonl").exists()


def test_logger_handles_empty_payload(tmp_path):
    logger = get_logger("test3", log_dir=str(tmp_path))
    log_event(logger, "empty_payload")
    log_file = tmp_path / "glideloop.jsonl"
    assert log_file.exists()
    payload = json.loads(log_file.read_text(encoding="utf-8").splitlines()[0])
    assert payload["payload"] == {}
