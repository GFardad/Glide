"""Tests for dev_env CLI main."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest

from runtime.dev_env import DevEnvironment, create_dev_env, get_dev_env


def test_create_and_get_dev_env(tmp_path):
    os.environ["GLIDELOOP_ROOT"] = str(tmp_path)
    env = create_dev_env(root=tmp_path)
    assert isinstance(get_dev_env(root=tmp_path), DevEnvironment)
    assert env.root == tmp_path


def test_main_status(tmp_path, monkeypatch):
    monkeypatch.setenv("GLIDELOOP_ROOT", str(tmp_path))
    dev = DevEnvironment(root=tmp_path)
    dev.create_dev_session("dev-1")

    import sys
    from runtime.dev_env import main
    import io
    import contextlib

    monkeypatch.setattr(sys, "argv", ["dev_env", "status"])
    captured = io.StringIO()
    with contextlib.redirect_stdout(captured):
        main()
    output = captured.getvalue()
    payload = json.loads(output)
    assert payload["dev"]["session_id"] == "dev-1"


def test_main_dev(tmp_path, monkeypatch):
    monkeypatch.setenv("GLIDELOOP_ROOT", str(tmp_path))
    import sys
    from runtime.dev_env import main
    import io
    import contextlib

    monkeypatch.setattr(sys, "argv", ["dev_env", "dev"])
    captured = io.StringIO()
    with contextlib.redirect_stdout(captured):
        main()
    output = captured.getvalue()
    assert "Dev session started" in output
    assert DevEnvironment(root=tmp_path).get_dev_session() is not None


def test_main_promote(tmp_path, monkeypatch):
    monkeypatch.setenv("GLIDELOOP_ROOT", str(tmp_path))
    dev = DevEnvironment(root=tmp_path)
    dev.create_dev_session("dev-1")
    root = dev.root
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

    import sys
    from runtime.dev_env import main
    import io
    import contextlib

    monkeypatch.setattr(sys, "argv", ["dev_env", "promote", "--tag", "release-2026.08.07"])
    captured = io.StringIO()
    with contextlib.redirect_stdout(captured):
        main()
    output = captured.getvalue()
    assert "Promoted release-2026.08.07" in output
