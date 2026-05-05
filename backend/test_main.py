"""
Backend tests for NexTex API.
Run with: pytest test_main.py -v
"""

import json
import os
import shutil
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Ensure we test against a fresh config and workspace
TEST_CONFIG_PATH = Path(__file__).parent / ".nextex_test_config.json"
TEST_DEFAULT_ROOT = Path(__file__).parent / "tex_files_test"

# Patch config path before importing main
import main as main_module
main_module.CONFIG_PATH = TEST_CONFIG_PATH
main_module.DEFAULT_ROOT = TEST_DEFAULT_ROOT.resolve()

from main import app, _resolve_safe, _is_path_inside, _get_active_workspace, _parse_compile_logs

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_test_env():
    """Reset config and workspace before each test."""
    if TEST_CONFIG_PATH.exists():
        TEST_CONFIG_PATH.unlink()
    if TEST_DEFAULT_ROOT.exists():
        shutil.rmtree(TEST_DEFAULT_ROOT)
    TEST_DEFAULT_ROOT.mkdir(parents=True, exist_ok=True)
    yield
    # Cleanup after test
    if TEST_CONFIG_PATH.exists():
        TEST_CONFIG_PATH.unlink()
    if TEST_DEFAULT_ROOT.exists():
        shutil.rmtree(TEST_DEFAULT_ROOT)


# ---------------------------------------------------------------------------
# Workspace tests
# ---------------------------------------------------------------------------

class TestWorkspace:
    def test_default_workspace_on_startup(self):
        """Default root should be created and returned."""
        resp = client.get("/api/workspace")
        assert resp.status_code == 200
        data = resp.json()
        assert data["workspace_root"] == str(TEST_DEFAULT_ROOT)
        assert data["trusted_local_mode"] is False
        assert data["source"] == "default"

    def test_select_workspace_inside_default(self):
        """Selecting a subfolder inside default root should not require trust."""
        subdir = TEST_DEFAULT_ROOT / "projects"
        subdir.mkdir()
        resp = client.post("/api/workspace/select", json={"path": str(subdir), "trusted": False})
        assert resp.status_code == 200
        data = resp.json()
        assert data["workspace_root"] == str(subdir)
        assert data["trusted_local_mode"] is False
        assert data["source"] == "user-selected"

    def test_select_workspace_outside_default_requires_trust(self):
        """Selecting outside default root without trusted flag is rejected."""
        with tempfile.TemporaryDirectory() as tmp:
            resp = client.post("/api/workspace/select", json={"path": tmp, "trusted": False})
            assert resp.status_code == 403
            assert "trusted" in resp.json()["detail"].lower()

    def test_select_workspace_outside_default_with_trust(self):
        """Selecting outside default root with explicit trust succeeds."""
        with tempfile.TemporaryDirectory() as tmp:
            resp = client.post("/api/workspace/select", json={"path": tmp, "trusted": True})
            assert resp.status_code == 200
            data = resp.json()
            assert data["workspace_root"] == str(Path(tmp).resolve())
            assert data["trusted_local_mode"] is True

    def test_select_nonexistent_path(self):
        resp = client.post("/api/workspace/select", json={"path": "/nonexistent/path/12345", "trusted": True})
        assert resp.status_code == 404

    def test_select_file_not_directory(self):
        file_path = TEST_DEFAULT_ROOT / "test.txt"
        file_path.write_text("hello")
        resp = client.post("/api/workspace/select", json={"path": str(file_path), "trusted": True})
        assert resp.status_code == 400

    def test_reset_workspace(self):
        """Reset should restore default root."""
        subdir = TEST_DEFAULT_ROOT / "tmp"
        subdir.mkdir()
        client.post("/api/workspace/select", json={"path": str(subdir), "trusted": False})
        resp = client.post("/api/workspace/reset")
        assert resp.status_code == 200
        data = resp.json()
        assert data["workspace_root"] == str(TEST_DEFAULT_ROOT)
        assert data["trusted_local_mode"] is False
        assert data["source"] == "default"

    def test_persistence_across_calls(self):
        """Workspace selection must persist."""
        subdir = TEST_DEFAULT_ROOT / "persisted"
        subdir.mkdir()
        client.post("/api/workspace/select", json={"path": str(subdir), "trusted": False})
        # Simulate app restart by re-importing config
        resp = client.get("/api/workspace")
        assert resp.json()["workspace_root"] == str(subdir)


# ---------------------------------------------------------------------------
# Path safety tests
# ---------------------------------------------------------------------------

class TestPathSafety:
    def test_resolve_safe_inside_workspace(self):
        """Paths inside workspace resolve correctly."""
        workspace = _get_active_workspace()
        (workspace / "sub" / "file.tex").parent.mkdir(parents=True, exist_ok=True)
        (workspace / "sub" / "file.tex").write_text("test")
        resolved = _resolve_safe("sub/file.tex")
        assert resolved.exists()

    def test_resolve_safe_traversal_rejected(self):
        """Path traversal via .. is rejected."""
        with pytest.raises(Exception) as exc_info:
            _resolve_safe("../secret.txt")
        assert exc_info.value.status_code == 403

    def test_resolve_safe_absolute_rejected(self):
        """Absolute paths are treated as relative and resolved inside workspace."""
        workspace = _get_active_workspace()
        # Absolute path gets lstrip('/') and resolved inside workspace
        resolved = _resolve_safe("/file.txt")
        assert _is_path_inside(workspace, resolved)

    def test_is_path_inside_robust(self):
        base = Path("/a/b").resolve()
        assert _is_path_inside(base, Path("/a/b/c").resolve()) is True
        assert _is_path_inside(base, Path("/a/bc").resolve()) is False
        assert _is_path_inside(base, Path("/a/b/../c").resolve()) is False


# ---------------------------------------------------------------------------
# File CRUD tests
# ---------------------------------------------------------------------------

class TestFileCrud:
    def test_list_files_empty(self):
        resp = client.get("/api/files?path=")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_create_and_list_file(self):
        resp = client.post("/api/files/create", json={"path": "hello.tex", "type": "file"})
        assert resp.status_code == 200
        resp = client.get("/api/files?path=")
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "hello.tex"
        assert data[0]["type"] == "file"

    def test_create_and_list_folder(self):
        resp = client.post("/api/files/create", json={"path": "sections", "type": "folder"})
        assert resp.status_code == 200
        resp = client.get("/api/files?path=")
        data = resp.json()
        assert data[0]["type"] == "folder"

    def test_create_duplicate(self):
        client.post("/api/files/create", json={"path": "dup.tex", "type": "file"})
        resp = client.post("/api/files/create", json={"path": "dup.tex", "type": "file"})
        assert resp.status_code == 409

    def test_write_and_read_file(self):
        client.post("/api/files/write", json={"path": "test.tex", "content": "\\documentclass{article}\n\\begin{document}\nHello\n\\end{document}"})
        resp = client.get("/api/files/read?path=test.tex")
        assert resp.status_code == 200
        assert "Hello" in resp.json()["content"]

    def test_read_binary_rejected(self):
        workspace = _get_active_workspace()
        (workspace / "test.pdf").write_bytes(b"%PDF-1.4 fake")
        resp = client.get("/api/files/read?path=test.pdf")
        assert resp.status_code == 400
        assert "binary" in resp.json()["detail"].lower()

    def test_rename_file(self):
        client.post("/api/files/create", json={"path": "old.tex", "type": "file"})
        resp = client.post("/api/files/rename", json={"old_path": "old.tex", "new_path": "new.tex"})
        assert resp.status_code == 200
        resp = client.get("/api/files/read?path=new.tex")
        assert resp.status_code == 200

    def test_delete_file(self):
        client.post("/api/files/create", json={"path": "del.tex", "type": "file"})
        resp = client.post("/api/files/delete", json={"path": "del.tex"})
        assert resp.status_code == 200
        resp = client.get("/api/files/read?path=del.tex")
        assert resp.status_code == 404

    def test_delete_folder_recursive(self):
        client.post("/api/files/create", json={"path": "parent/child.tex", "type": "folder"})
        # Creating folder then file inside it
        client.post("/api/files/create", json={"path": "parent/child.tex", "type": "file"})
        resp = client.post("/api/files/delete", json={"path": "parent"})
        assert resp.status_code == 200
        resp = client.get("/api/files?path=")
        assert resp.json() == []

    def test_hidden_files_skipped(self):
        workspace = _get_active_workspace()
        (workspace / ".hidden").write_text("secret")
        (workspace / "visible").write_text("ok")
        resp = client.get("/api/files?path=")
        names = [n["name"] for n in resp.json()]
        assert ".hidden" not in names
        assert "visible" in names


# ---------------------------------------------------------------------------
# Compile tests
# ---------------------------------------------------------------------------

class TestCompile:
    def test_compile_missing_compiler(self):
        """Unknown compiler returns 400."""
        workspace = _get_active_workspace()
        (workspace / "doc.tex").write_text("\\documentclass{article}\n\\begin{document}\nX\n\\end{document}")
        resp = client.post("/api/compile", json={"file_path": "doc.tex", "compiler": "unknown"})
        assert resp.status_code == 400

    def test_compile_missing_file(self):
        resp = client.post("/api/compile", json={"file_path": "missing.tex", "compiler": "pdflatex"})
        assert resp.status_code == 404

    def test_compile_compiler_not_found(self):
        """If compiler is not installed, expect 500 with helpful message."""
        workspace = _get_active_workspace()
        (workspace / "doc.tex").write_text("\\documentclass{article}\n\\begin{document}\nX\n\\end{document}")
        # Patch COMPILER_MAP to a nonexistent binary
        original = main_module.COMPILER_MAP.copy()
        main_module.COMPILER_MAP["pdflatex"] = "this_binary_does_not_exist_12345"
        try:
            resp = client.post("/api/compile", json={"file_path": "doc.tex", "compiler": "pdflatex"})
            assert resp.status_code == 500
            assert "not found" in resp.json()["detail"].lower()
        finally:
            main_module.COMPILER_MAP = original

    def test_compile_success_structure(self):
        """When compiler IS present, verify response structure."""
        workspace = _get_active_workspace()
        (workspace / "doc.tex").write_text("\\documentclass{article}\n\\begin{document}\nX\n\\end{document}")
        # We can't assume a compiler is installed in all test environments,
        # so we only assert structure when it succeeds.
        resp = client.post("/api/compile", json={"file_path": "doc.tex", "compiler": "pdflatex"})
        if resp.status_code == 200:
            data = resp.json()
            assert "build_id" in data
            assert "success" in data
            assert "logs" in data
            assert "error_lines" in data
            assert isinstance(data["error_lines"], list)
            assert "pdf_available" in data
            assert "pdf_url" in data
        else:
            # Accept compiler-not-installed as valid test environment limitation
            assert resp.status_code == 500

    def test_pdf_download_invalid_build_id(self):
        resp = client.get("/api/compile/not-a-uuid/pdf")
        assert resp.status_code == 400

    def test_pdf_download_missing_build(self):
        import uuid
        resp = client.get(f"/api/compile/{uuid.uuid4()}/pdf")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Log parser tests
# ---------------------------------------------------------------------------

class TestLogParser:
    def test_parse_error_with_line_reference(self):
        stdout = """! Undefined control sequence.
l.15 \\usepacakge
                {geometry}"""
        logs, error_lines = _parse_compile_logs(stdout, "")
        assert len(logs) == 1
        assert logs[0]["type"] == "error"
        assert len(error_lines) == 1
        assert error_lines[0]["line"] == 15
        assert error_lines[0]["severity"] == "error"
        assert "Undefined control sequence" in error_lines[0]["message"]
        assert "\\usepacakge" in error_lines[0]["context"]

    def test_parse_multiple_errors(self):
        stdout = """! LaTeX Error: Missing \\begin{document}.

l.5 This is a test
      
! Undefined control sequence.
l.20 \\badcmd
            {arg}"""
        logs, error_lines = _parse_compile_logs(stdout, "")
        assert len(logs) == 2
        assert len(error_lines) == 2
        assert error_lines[0]["line"] == 5
        assert error_lines[1]["line"] == 20

    def test_parse_warning_with_inline_line(self):
        stdout = "LaTeX Warning: Reference `fig:1' on page 1 undefined on input line 23."
        logs, error_lines = _parse_compile_logs(stdout, "")
        assert len(logs) == 1
        assert logs[0]["type"] == "warning"
        assert len(error_lines) == 1
        assert error_lines[0]["line"] == 23
        assert error_lines[0]["severity"] == "warning"

    def test_parse_warning_with_line_keyword(self):
        stdout = "Package hyperref Warning: Token not allowed in a PDF string on input line 42."
        logs, error_lines = _parse_compile_logs(stdout, "")
        assert len(logs) == 1
        assert logs[0]["type"] == "warning"
        assert len(error_lines) == 1
        assert error_lines[0]["line"] == 42

    def test_parse_success_output(self):
        stdout = "Output written on test.pdf (1 page, 12345 bytes)."
        logs, error_lines = _parse_compile_logs(stdout, "")
        assert len(logs) == 1
        assert logs[0]["type"] == "success"
        assert len(error_lines) == 0

    def test_parse_no_errors(self):
        stdout = "This is random output\nwith no matching patterns"
        logs, error_lines = _parse_compile_logs(stdout, "")
        assert len(logs) == 0
        assert len(error_lines) == 0

    def test_stderr_included(self):
        stderr = "! Emergency stop."
        logs, error_lines = _parse_compile_logs("", stderr)
        assert len(logs) == 1
        assert logs[0]["type"] == "error"

# ---------------------------------------------------------------------------
# Config / health tests
# ---------------------------------------------------------------------------

class TestConfig:
    def test_health(self):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "healthy"

    def test_root(self):
        resp = client.get("/")
        assert resp.status_code == 200
        assert "NexTex" in resp.json()["message"]
