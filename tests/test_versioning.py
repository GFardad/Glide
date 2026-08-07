"""Tests for runtime versioning package."""

from __future__ import annotations

import json

import pytest

from runtime.versioning.versioning import VersionLifecycle, VersionManifest


def test_create_and_list_versions(tmp_path):
    lifecycle = VersionLifecycle(tmp_path)
    lifecycle.create_version("1.0.0", codename="alpha")
    versions = lifecycle.list_versions()
    assert len(versions) == 1
    assert versions[0]["version"] == "1.0.0"
    assert versions[0]["codename"] == "alpha"
    assert versions[0]["active"] is True


def test_activate_and_release_version(tmp_path):
    lifecycle = VersionLifecycle(tmp_path)
    lifecycle.create_version("1.0.0")
    lifecycle.create_version("2.0.0")
    lifecycle.activate_version("2.0.0")
    versions = lifecycle.list_versions()
    assert versions[0]["status"] == "planned"
    assert versions[1]["status"] == "active"
    assert versions[1]["active"] is True
    lifecycle.release_version("2.0.0")
    versions = lifecycle.list_versions()
    assert versions[1]["status"] == "released"
    assert versions[1]["released_at"] is not None


def test_duplicate_version_raises(tmp_path):
    lifecycle = VersionLifecycle(tmp_path)
    lifecycle.create_version("1.0.0")
    with pytest.raises(ValueError):
        lifecycle.create_version("1.0.0")


def test_get_active_version(tmp_path):
    lifecycle = VersionLifecycle(tmp_path)
    assert lifecycle.get_active_version() is None
    lifecycle.create_version("1.0.0")
    active = lifecycle.get_active_version()
    assert isinstance(active, VersionManifest)
    assert active.version == "1.0.0"
