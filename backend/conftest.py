"""Every API test uses a disposable workspace and configuration file."""

import pytest
import main


@pytest.fixture(autouse=True)
def isolated_workspace(tmp_path, monkeypatch):
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    monkeypatch.setattr(main, "CONFIG_PATH", tmp_path / "config.json")
    monkeypatch.setattr(main, "DEFAULT_ROOT", workspace.resolve())
    yield workspace
