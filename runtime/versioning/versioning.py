"""Version lifecycle for next-version development."""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from runtime.logging import get_logger, log_event

logger = get_logger("glideloop.version")


@dataclass
class VersionManifest:
    """Manifest for a version."""

    version: str
    codename: str = ""
    status: str = "planned"  # planned | active | released | rolledback
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    released_at: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


class VersionLifecycle:
    """Manages version lifecycle for next-version development."""

    def __init__(self, root: Path) -> None:
        self.root = root
        self.manifest_file = root / "runtime" / "state" / "version-manifest.json"
        self._state: dict[str, Any] = self._load()

    def _load(self) -> dict[str, Any]:
        if self.manifest_file.exists():
            return json.loads(self.manifest_file.read_text(encoding="utf-8"))
        return {"versions": {}, "active_version": None}

    def _save(self) -> None:
        self.manifest_file.parent.mkdir(parents=True, exist_ok=True)
        self.manifest_file.write_text(json.dumps(self._state, indent=2), encoding="utf-8")

    def create_version(self, version: str, codename: str = "") -> VersionManifest:
        """Create a new version."""
        if version in self._state["versions"]:
            raise ValueError(f"Version {version} already exists")
        manifest = VersionManifest(version=version, codename=codename)
        self._state["versions"][version] = {
            "version": manifest.version,
            "codename": manifest.codename,
            "status": manifest.status,
            "created_at": manifest.created_at,
            "released_at": manifest.released_at,
            "metadata": manifest.metadata,
        }
        self._state["active_version"] = version
        self._save()
        log_event(logger, "version_created", payload={"version": version, "codename": codename})
        return manifest

    def activate_version(self, version: str) -> VersionManifest:
        """Activate a version for development."""
        if version not in self._state["versions"]:
            raise ValueError(f"Version {version} not found")
        self._state["active_version"] = version
        self._state["versions"][version]["status"] = "active"
        self._save()
        log_event(logger, "version_activated", payload={"version": version})
        return self.get_version(version)

    def release_version(self, version: str) -> VersionManifest:
        """Mark a version as released."""
        if version not in self._state["versions"]:
            raise ValueError(f"Version {version} not found")
        now = datetime.now(timezone.utc).isoformat()
        self._state["versions"][version]["status"] = "released"
        self._state["versions"][version]["released_at"] = now
        self._save()
        log_event(logger, "version_released", payload={"version": version, "released_at": now})
        return self.get_version(version)

    def get_version(self, version: str) -> VersionManifest:
        """Get a version manifest."""
        data = self._state["versions"].get(version)
        if not data:
            raise ValueError(f"Version {version} not found")
        return VersionManifest(**data)

    def get_active_version(self) -> VersionManifest | None:
        """Get the active version."""
        version = self._state.get("active_version")
        if not version:
            return None
        return self.get_version(version)

    def list_versions(self) -> list[dict[str, Any]]:
        """List all versions."""
        return [
            {
                "version": v["version"],
                "codename": v["codename"],
                "status": v["status"],
                "created_at": v["created_at"],
                "released_at": v["released_at"],
                "active": v["version"] == self._state.get("active_version"),
            }
            for v in self._state["versions"].values()
        ]
