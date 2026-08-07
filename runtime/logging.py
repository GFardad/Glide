"""Glideloop structured logging with correlation IDs and masking."""

from __future__ import annotations

import json
import logging
import os
import re
import uuid
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any, Callable, Optional

__all__ = ["get_logger", "log_event", "mask_payload", "with_correlation"]

_DEFAULT_LOG_DIR = os.environ.get("GLIDELOOP_LOGS", "/tmp/glideloop-logs")
_LOG_MAX_BYTES = 10 * 1024 * 1024
_LOG_BACKUP_COUNT = 7

_SENSITIVE_KEYS = re.compile(r"(token|secret|password|api_key|authorization)", re.IGNORECASE)
_SENSITIVE_VALUE = "[REDACTED]"


def _ensure_log_dir(path: str) -> Path:
    log_path = Path(path)
    log_path.mkdir(parents=True, exist_ok=True)
    return log_path


def mask_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Mask sensitive fields in a payload for safe logging."""

    def _mask(value: Any) -> Any:
        if isinstance(value, dict):
            return {k: _mask(v) if not _SENSITIVE_KEYS.search(k) else _SENSITIVE_VALUE for k, v in value.items()}
        if isinstance(value, list):
            return [_mask(item) for item in value]
        return value

    return _mask(payload)


class CorrelationFilter(logging.Filter):
    """Inject a correlation ID into log records."""

    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "correlation_id"):
            record.correlation_id = str(uuid.uuid4())
        return True


def _json_formatter(record: logging.LogRecord) -> str:
    payload = getattr(record, "payload", {})
    masked = mask_payload(payload)
    log_entry = {
        "timestamp": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        "level": record.levelname,
        "logger": record.name,
        "correlation_id": getattr(record, "correlation_id", None),
        "message": record.getMessage(),
        "payload": masked,
        "duration_ms": getattr(record, "duration_ms", None),
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
    handler.addFilter(CorrelationFilter())
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    return logger


def log_event(logger: logging.Logger, message: str, payload: Optional[dict[str, Any]] = None) -> None:
    extra = {"payload": payload or {}}
    logger.info(message, extra=extra)


def with_correlation(fn: Callable[..., Any]) -> Callable[..., Any]:
    """Decorator to inject a correlation ID into log records for a function call."""

    def wrapper(*args: Any, **kwargs: Any) -> Any:
        logger = logging.getLogger(fn.__module__)
        correlation_id = str(uuid.uuid4())
        for handler in logger.handlers:
            # Replace existing CorrelationFilter instances with ones seeded with this ID.
            handler.filters = [f for f in handler.filters if not isinstance(f, CorrelationFilter)]
            seeded = CorrelationFilter()
            seeded.correlation_id = correlation_id  # type: ignore[attr-defined]
            handler.filters.append(seeded)
        return fn(*args, **kwargs)

    return wrapper
