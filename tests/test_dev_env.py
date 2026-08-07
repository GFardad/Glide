"""Tests for runtime dev_env."""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

import pytest

from runtime.dev_env import BranchStatus, DevEnvironment, DevSession, ProductionSession, create_dev_env, get_dev_env


@pytest.fixture()
def dev_env(tmp_path):
    os.environ["GLIDELOOP_ROOT"] = str(tmp_path)
    (tmp_path / "runtime" / "state").mkdir(parents=True)
    return create_dev_env(root=tmp_path)


def test_create_and_get_dev_env(dev_env):
    assert isinstance(get_dev_env(root=dev_env.root), DevEnvironment)


def test_production_session_lifecycle(dev_env):
    session = dev_env.create_production_session("prod-1")
    assert session.role == "production_cto"
    assert session.branch == "main"
    loaded = dev_env.get_production_session()
    assert loaded is not None
    assert loaded.session_id == "prod-1"


def test_dev_session_lifecycle(dev_env):
    session = dev_env.create_dev_session("dev-1")
    assert session.role == "dev_cto"
    assert session.branch == "dev"
    assert dev_env.get_dev_session().session_id == "dev-1"


def test_link_sessions(dev_env):
    dev_env.create_production_session("prod-1")
    dev_env.create_dev_session("dev-1")
    dev_env.link_sessions("prod-1", "dev-1")
    assert dev_env.get_production_session().dev_session_id == "dev-1"
    dev = dev_env.get_dev_session()
    assert dev is not None
    assert dev.status == "controlled"


def test_update_dev_status(dev_env):
    dev_env.create_dev_session("dev-1")
    dev_env.update_dev_status("running", "working on feature")
    assert dev_env.get_dev_session().status == "running"
    assert dev_env.get_dev_session().last_output == "working on feature"


def test_update_production_status(dev_env):
    dev_env.create_production_session("prod-1")
    dev_env.update_production_status("reviewing")
    assert dev_env.get_production_session().status == "reviewing"


def test_get_branch_status(dev_env):
    status = dev_env.get_branch_status("main")
    assert isinstance(status, BranchStatus)
    assert status.branch == "main"


def test_get_status(dev_env):
    dev_env.create_production_session("prod-1")
    dev_env.create_dev_session("dev-1")
    status = dev_env.get_status()
    assert status["production"]["session_id"] == "prod-1"
    assert status["dev"]["session_id"] == "dev-1"


def test_approve_dev(dev_env):
    dev_env.create_production_session("prod-1")
    dev_env.create_dev_session("dev-1")
    root = dev_env.root
    for name in ("GOAL.md", "TODO.md", "NOTES.md", "REJECTED.md"):
        (root / name).write_text("ok", encoding="utf-8")
    (root / "tests").mkdir(exist_ok=True)
    (root / "pyproject.toml").write_text("[tool.pytest.ini_options]\n", encoding="utf-8")
    (root / "tests" / "test_approve.py").write_text("def test_ok(): pass\n", encoding="utf-8")
    subprocess.run(["git", "init", "-b", "main"], cwd=root, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.email", "test@test.com"], cwd=root, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.name", "Test"], cwd=root, check=True, capture_output=True)
    (root / "README.md").write_text("base", encoding="utf-8")
    subprocess.run(["git", "add", "README.md"], cwd=root, check=True, capture_output=True)
    subprocess.run(["git", "commit", "-m", "init"], cwd=root, check=True, capture_output=True)
    subprocess.run(["git", "checkout", "-b", "dev"], cwd=root, check=True, capture_output=True)
    subprocess.run(["git", "checkout", "main"], cwd=root, check=True, capture_output=True)
    assert dev_env.approve_dev() is True
    assert dev_env.get_production_session().status == "idle"


def test_promote_to_release(dev_env):
    dev_env.create_production_session("prod-1")
    dev_env.create_dev_session("dev-1")
    root = dev_env.root
    subprocess.run(["git", "init", "-b", "main"], cwd=root, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.email", "cto@example.com"], cwd=root, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.name", "CTO"], cwd=root, check=True, capture_output=True)
    (root / "README.md").write_text("hello", encoding="utf-8")
    subprocess.run(["git", "add", "README.md"], cwd=root, check=True, capture_output=True)
    subprocess.run(["git", "commit", "-m", "init"], cwd=root, check=True, capture_output=True)
    subprocess.run(["git", "checkout", "-b", "dev"], cwd=root, check=True, capture_output=True)
    (root / "DEV.md").write_text("world", encoding="utf-8")
    subprocess.run(["git", "add", "DEV.md"], cwd=root, check=True, capture_output=True)
    subprocess.run(["git", "commit", "-m", "dev"], cwd=root, check=True, capture_output=True)
    subprocess.run(["git", "checkout", "main"], cwd=root, check=True, capture_output=True)
    (root / "README.md").write_text("base", encoding="utf-8")
    subprocess.run(["git", "add", "README.md"], cwd=root, check=True, capture_output=True)
    subprocess.run(["git", "commit", "-m", "base"], cwd=root, check=True, capture_output=True)
    remote = root / "remote.git"
    subprocess.run(["git", "init", "--bare", str(remote)], check=True, capture_output=True)
    subprocess.run(["git", "remote", "add", "origin", str(remote)], cwd=root, check=True, capture_output=True)
    version = dev_env.promote_to_release(tag="release-2026.08.07")
    assert version == "release-2026.08.07"
    assert dev_env.get_production_session().release_version == version
    assert len(dev_env.get_status()["releases"]) == 1


def test_state_file_persistence(dev_env):
    dev_env.create_production_session("prod-1")
    reloaded = DevEnvironment(root=dev_env.root)
    assert reloaded.get_production_session().session_id == "prod-1"
