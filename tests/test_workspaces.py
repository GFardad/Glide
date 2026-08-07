"""Tests for runtime branch-aware workspaces."""

from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path

import pytest

from runtime.workspaces import BranchWorkspaceManager, create_branch_workspace, get_branch_workspace_manager


def test_create_and_list_branch_workspace():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        subprocess.run(["git", "init", "-b", "main"], cwd=root, check=True, capture_output=True)
        subprocess.run(["git", "config", "user.email", "test@test.com"], cwd=root, check=True, capture_output=True)
        subprocess.run(["git", "config", "user.name", "Test"], cwd=root, check=True, capture_output=True)
        (root / "README.md").write_text("base", encoding="utf-8")
        subprocess.run(["git", "add", "README.md"], cwd=root, check=True, capture_output=True)
        subprocess.run(["git", "commit", "-m", "init"], cwd=root, check=True, capture_output=True)
        remote = root / "remote.git"
        subprocess.run(["git", "init", "--bare", str(remote)], check=True, capture_output=True)
        subprocess.run(["git", "remote", "add", "origin", str(remote)], cwd=root, check=True, capture_output=True)
        subprocess.run(["git", "push", "origin", "main"], cwd=root, check=True, capture_output=True)
        os.environ["GLIDELOOP_ROOT"] = str(root)
        workspace = create_branch_workspace("feature-1", base_branch="main")
        assert workspace.branch == "feature-1"
        assert workspace.worktree_path.exists()
        manager = get_branch_workspace_manager()
        workspaces = manager.list_workspaces()
        assert len(workspaces) == 1
        assert workspaces[0]["branch"] == "feature-1"
