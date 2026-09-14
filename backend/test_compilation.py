"""Compile orchestration behavior, plus real TeX integration in temp workspaces."""

import asyncio
import base64
import io
import shutil
import subprocess
import threading
import time
from pathlib import Path

import httpx
import pytest
from PIL import Image
from fastapi.testclient import TestClient

import main

client = TestClient(main.app, raise_server_exceptions=False)


def fake_compiler(command, **kwargs):
    output_arg = next((item for item in command if item.startswith(("-output-directory=", "-outdir="))), None)
    output = Path(output_arg.split("=", 1)[1])
    source = Path(command[-1])
    (output / (source.stem + ".pdf")).write_bytes(b"%PDF-1.4 test")
    return subprocess.CompletedProcess(command, 0, "Output written on doc.pdf (1 page).", "")


def test_compile_does_not_block_health_and_rejects_parallel_job(isolated_workspace, monkeypatch):
    (isolated_workspace / "doc.tex").write_text("Hello")
    entered = threading.Event()
    def slow_compiler(command, **kwargs):
        entered.set()
        time.sleep(0.3)
        return fake_compiler(command, **kwargs)
    monkeypatch.setattr(main, "_run_command", slow_compiler)
    monkeypatch.setattr(main.shutil, "which", lambda name: "/usr/bin/" + name)

    async def exercise():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://127.0.0.1") as http:
            first = asyncio.create_task(http.post("/api/compile", json={"file_path": "doc.tex"}))
            for _ in range(100):
                await asyncio.sleep(0.01)
                if entered.is_set():
                    break
            health = await http.get("/health")
            still_running = not first.done()
            second = await http.post("/api/compile", json={"file_path": "doc.tex"})
            first_response = await first
            assert health.status_code == 200
            assert still_running, "The blocking compiler prevented /health from responding"
            assert second.status_code == 409
            assert first_response.status_code == 200
    asyncio.run(exercise())


def test_engine_fallback_repeats_passes_with_shell_escape_disabled(isolated_workspace, monkeypatch):
    (isolated_workspace / "doc.tex").write_text("Hello")
    monkeypatch.setattr(main.shutil, "which", lambda name: None if name == "latexmk" else "/usr/bin/" + name)
    calls = []
    def compile_and_check(command, **kwargs):
        calls.append(command)
        return fake_compiler(command, **kwargs)
    monkeypatch.setattr(main, "_run_command", compile_and_check)
    response = client.post("/api/compile", json={"file_path": "doc.tex"})
    assert response.status_code == 200
    assert response.json()["success"] is True
    assert 2 <= len(calls) <= 3
    assert all("-no-shell-escape" in command for command in calls)


def test_latexmk_ignores_project_rc_and_disables_shell_escape(isolated_workspace, monkeypatch):
    (isolated_workspace / "doc.tex").write_text("Hello")
    monkeypatch.setattr(main.shutil, "which", lambda name: "/usr/bin/" + name)
    calls = []
    def compile_and_check(command, **kwargs):
        calls.append(command)
        return fake_compiler(command, **kwargs)
    monkeypatch.setattr(main, "_run_command", compile_and_check)
    response = client.post("/api/compile", json={"file_path": "doc.tex"})
    assert response.status_code == 200
    assert calls[0][0].endswith("latexmk")
    assert "-norc" in calls[0]
    assert any("-no-shell-escape" in item for item in calls[0])


def test_preprocessing_detects_multirow_and_grouped_packages():
    content = "\\documentclass{article}\n\\usepackage{array,graphicx}\n\\begin{document}\n\\multirow{2}{*}{X}\\includegraphics{x}\n\\end{document}"
    missing = main._detect_missing_packages(content)
    assert "multirow" in missing
    assert "graphicx" not in missing


def test_generated_preamble_error_lines_map_to_original_source(isolated_workspace, monkeypatch):
    (isolated_workspace / "doc.tex").write_text("Hello\n\\badcommand")
    def compiler_error(command, **kwargs):
        source = Path(command[-1])
        error_line = source.read_text().splitlines().index("\\badcommand") + 1
        return subprocess.CompletedProcess(command, 1, f"{source}:{error_line}: Undefined control sequence.\nl.{error_line} \\badcommand\n", "")
    monkeypatch.setattr(main, "_run_command", compiler_error)
    monkeypatch.setattr(main.shutil, "which", lambda name: "/usr/bin/" + name)
    response = client.post("/api/compile", json={"file_path": "doc.tex"})
    assert response.status_code == 200
    result = response.json()
    assert result["success"] is False
    assert any(item["line"] == 2 and item["file"] == "doc.tex" for item in result["error_lines"])


def test_compile_timeout_cleans_old_builds_and_releases_job(isolated_workspace, monkeypatch):
    (isolated_workspace / "doc.tex").write_text("Hello")
    monkeypatch.setattr(main, "MAX_RETAINED_BUILDS", 2)
    def timeout(command, **kwargs):
        raise subprocess.TimeoutExpired(command, 60)
    monkeypatch.setattr(main, "_run_command", timeout)
    monkeypatch.setattr(main.shutil, "which", lambda name: "/usr/bin/" + name)
    for _ in range(4):
        assert client.post("/api/compile", json={"file_path": "doc.tex"}).status_code == 504
    builds = list((isolated_workspace / ".nextex_builds").iterdir())
    assert len(builds) <= 2


@pytest.mark.skipif(not shutil.which("pdflatex"), reason="A TeX distribution is required for integration smoke tests")
def test_real_tex_resolves_reference_and_blocks_write18(isolated_workspace):
    source = r"""\documentclass{article}
\begin{document}
\immediate\write18{touch shell-escape-marker}
\section{A}\label{sec:a}
Reference: \ref{sec:a}.
\end{document}
"""
    (isolated_workspace / "doc.tex").write_text(source)
    response = client.post("/api/compile", json={"file_path": "doc.tex"})
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["success"], result["logs"]
    assert not (isolated_workspace / "shell-escape-marker").exists()
    log = (Path(result["build_dir"]) / "doc.log").read_text()
    assert "There were undefined references" not in log
    assert "Label(s) may have changed" not in log
    pdf = client.get(result["pdf_url"])
    assert pdf.status_code == 200
    assert pdf.content.startswith(b"%PDF-")


@pytest.mark.skipif(not shutil.which("pdflatex") or not shutil.which("bibtex"), reason="TeX and BibTeX are required")
@pytest.mark.parametrize("use_latexmk", [True, False])
def test_real_tex_resolves_bibliography(isolated_workspace, monkeypatch, use_latexmk):
    if not use_latexmk:
        actual_which = main.shutil.which
        monkeypatch.setattr(main.shutil, "which", lambda name: None if name == "latexmk" else actual_which(name))
    (isolated_workspace / "references.bib").write_text('@book{sample,author={A. Author},title={Example Book},year={2024},publisher={Example}}')
    (isolated_workspace / "doc.tex").write_text(r"""\documentclass{article}
\begin{document}
See \cite{sample}.
\bibliographystyle{plain}
\bibliography{references}
\end{document}
""")
    response = client.post("/api/compile", json={"file_path": "doc.tex"})
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["success"], result["logs"]
    assert (Path(result["build_dir"]) / "doc.bbl").exists()
    assert "There were undefined references" not in (Path(result["build_dir"]) / "doc.log").read_text()


@pytest.mark.skipif(not shutil.which("pdflatex"), reason="A TeX distribution is required")
def test_real_diagnostic_reports_original_line(isolated_workspace):
    (isolated_workspace / "doc.tex").write_text("Hello\n\\notarealcommand")
    response = client.post("/api/compile", json={"file_path": "doc.tex"})
    assert response.status_code == 200, response.text
    result = response.json()
    assert not result["success"]
    assert any(item["line"] == 2 and item["file"] == "doc.tex" for item in result["error_lines"]), result


@pytest.mark.parametrize("compiler,command", [("pdflatex", "pdflatex"), ("xetex", "xelatex"), ("luatex", "lualatex")])
def test_real_compilers_embed_uploaded_image_and_multirow(compiler, command, isolated_workspace):
    if not shutil.which(command):
        pytest.skip(f"{command} is not installed")
    stream = io.BytesIO()
    Image.new("RGB", (8, 8), (100, 150, 200)).save(stream, format="WEBP")
    upload = client.post("/api/assets/upload", json={"path": "assets/image.webp", "content_base64": base64.b64encode(stream.getvalue()).decode()})
    assert upload.status_code == 200, upload.text
    (isolated_workspace / "doc.tex").write_text(r"""\documentclass{article}
\begin{document}
\includegraphics[width=1cm]{assets/image.png}
\begin{tabular}{ll}
\multirow{2}{*}{A} & B \\
 & C \\
\end{tabular}
\end{document}
""")
    response = client.post("/api/compile", json={"file_path": "doc.tex", "compiler": compiler})
    assert response.status_code == 200, response.text
    assert response.json()["success"], response.json()["logs"]


@pytest.mark.skipif(not shutil.which("pdflatex") or not shutil.which("biber"), reason="TeX and Biber are required")
def test_real_fallback_runs_biber(isolated_workspace, monkeypatch):
    actual_which = main.shutil.which
    monkeypatch.setattr(main.shutil, "which", lambda name: None if name == "latexmk" else actual_which(name))
    (isolated_workspace / "references.bib").write_text('@book{sample,author={A. Author},title={Example Book},year={2024},publisher={Example}}')
    (isolated_workspace / "doc.tex").write_text(r"""\documentclass{article}
\usepackage[backend=biber]{biblatex}
\addbibresource{references.bib}
\begin{document}
See \cite{sample}.
\printbibliography
\end{document}
""")
    response = client.post("/api/compile", json={"file_path": "doc.tex"})
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["success"], result["logs"]
    assert "Example Book" in (Path(result["build_dir"]) / "doc.bbl").read_text()
