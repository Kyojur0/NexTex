"""Shutdown must stop detached compiler processes before the API exits."""

import json
import os
import signal
import subprocess
import sys
import threading
import time

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

import main


@pytest.fixture(autouse=True)
def restore_lifecycle_state():
    yield
    # Other API tests deliberately use TestClient without a lifespan context.
    if hasattr(main, "_COMPILERS_SHUTTING_DOWN"):
        main._COMPILERS_SHUTTING_DOWN.clear()


@pytest.mark.skipif(os.name != "posix", reason="POSIX process-group shutdown")
def test_shutdown_kills_running_compiler_and_its_child(tmp_path):
    ready = tmp_path / "processes.json"
    script = (
        "import json, os, pathlib, subprocess, sys\n"
        "child = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(120)'])\n"
        "pathlib.Path(sys.argv[1]).write_text(json.dumps([os.getpid(), child.pid]))\n"
        "child.wait()\n"
    )
    results = []

    def compile_in_worker():
        try:
            results.append(main._run_command(
                [sys.executable, "-c", script, str(ready)],
                cwd=str(tmp_path), env=dict(os.environ), timeout=120,
            ))
        except BaseException as error:
            results.append(error)

    worker = threading.Thread(target=compile_in_worker, daemon=True)
    pids = []
    try:
        with TestClient(main.app):
            worker.start()
            deadline = time.monotonic() + 5
            while not ready.exists() and time.monotonic() < deadline:
                time.sleep(0.01)
            assert ready.exists(), f"Synthetic compiler did not start: {results}"
            pids = json.loads(ready.read_text())
            assert worker.is_alive()

        worker.join(timeout=1)
        assert not worker.is_alive(), "API shutdown left its detached compiler running"
        assert len(results) == 1 and isinstance(results[0], subprocess.CompletedProcess)
        assert results[0].returncode < 0
        # A killed orphan may briefly remain a zombie until the OS reaps it.
        states = subprocess.run(
            ["ps", "-o", "stat=", "-p", ",".join(map(str, pids))],
            capture_output=True, text=True, check=False,
        ).stdout.split()
        assert all(state.startswith("Z") for state in states), states
    finally:
        if pids:
            try:
                os.killpg(pids[0], signal.SIGKILL)
            except ProcessLookupError:
                pass
        worker.join(timeout=2)


def test_shutdown_prevents_another_compiler_pass(tmp_path, monkeypatch):
    with TestClient(main.app):
        pass

    def unexpected_spawn(*args, **kwargs):
        pytest.fail("A compiler was spawned after shutdown started")

    monkeypatch.setattr(main.subprocess, "Popen", unexpected_spawn)
    with pytest.raises(HTTPException) as error:
        main._run_command(["pdflatex"], cwd=str(tmp_path), env={}, timeout=60)
    assert error.value.status_code == 503
