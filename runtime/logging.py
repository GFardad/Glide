"""Glideloop structured logging."""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any, Optional

__all__ = ["get_logger", "log_event"]

_DEFAULT_LOG_DIR = os.environ.get("GLIDELOOP_LOGS", "/tmp/glideloop-logs")
_LOG_MAX_BYTES = 10 * 1024 * 1024
_LOG_BACKUP_COUNT = 7


def _ensure_log_dir(path: str) -> Path:
    log_path = Path(path)
    log_path.mkdir(parents=True, exist_ok=True)
    return log_path


def _json_formatter(record: logging.LogRecord) -> str:
    payload = getattr(record, "payload", {})
    log_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "level": record.levelname,
        "logger": record.name,
        "message": record.getMessage(),
        "payload": payload,
    }
    if record.exc_info and record.exc_info[0]:
        log_entry["exception"] = logging.Formatter().formatException(record.exc_info)
    text = json.dumps(log_entry, ensure_ascii=False)
    return f"{text}\n"


def get_logger(name: str, log_dir: Optional[str] = None) -> logging.Logger:
    logger = logging.Logger(name)
    log_directory = _ensure_log_dir(log_dir or _DEFAULT_LOG_DIR)
    log_file = log_directory / "glideloop.jsonl"
    handler = RotatingFileHandler(
        str(log_file),
        maxBytes=_LOG_MAX_BYTES,
        backupCount=_LOG_BACKUP_COUNT,
        encoding="utf-8",
    )
    handler.setFormatter(logging.Formatter())
    handler.format = _json_formatter  # type: ignore[method-assign]
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    return logger


def log_event(logger: logging.Logger, message: str, payload: Optional[dict[str, Any]] = None) -> None:
    extra = {"payload": payload or {}}
    logger.info(message, extra=extra)
