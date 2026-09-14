"""Real HTTP and stdio clients against a disposable running NexTex backend."""
import asyncio
import base64
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import time

import httpx
from mcp import Client, StdioServerParameters
import pytest

BACKEND = Path(__file__).resolve().parent


@pytest.mark.parametrize("transport", ["http", "stdio"])
def test_real_mcp_transports(transport, isolated_workspace, tmp_path):
    listener = socket.socket()
    listener.bind(("127.0.0.1", 0))
    port = listener.getsockname()[1]
    base_url = f"http://127.0.0.1:{port}"
    env = {**os.environ, "NEXTEX_WORKSPACE_ROOT": str(isolated_workspace),
           "NEXTEX_CONFIG_PATH": str(tmp_path / "running-config.json"), "NEXTEX_API_URL": base_url}
    with (tmp_path / "backend.log").open("w") as log:
        process = subprocess.Popen([sys.executable, "-m", "uvicorn", "main:app", "--app-dir", str(BACKEND),
                                    "--fd", str(listener.fileno())], pass_fds=(listener.fileno(),),
                                   env=env, stdout=log, stderr=log)
        listener.close()
        try:
            deadline = time.monotonic() + 20
            while True:
                try:
                    if httpx.get(base_url + "/health", timeout=1, trust_env=False).status_code == 200:
                        break
                except httpx.RequestError:
                    pass
                assert process.poll() is None, (tmp_path / "backend.log").read_text()
                assert time.monotonic() < deadline, "Backend did not start"
                time.sleep(0.05)

            async def scenario():
                endpoint = base_url + "/mcp" if transport == "http" else StdioServerParameters(
                    command=sys.executable, args=[str(BACKEND / "mcp_server.py")], env={"NEXTEX_API_URL": base_url})
                async with Client(endpoint) as client:
                    assert len((await client.list_tools()).tools) == 15
                    result = await client.call_tool("create_file", {"path": "agent.tex", "content":
                        "\\documentclass{article}\n\\begin{document}\nHello from MCP.\n\\end{document}\n"})
                    assert not result.is_error, result
                    read = await client.call_tool("read_file", {"path": "agent.tex"})
                    assert "Hello from MCP" in read.structured_content["content"]
                    if shutil.which("pdflatex"):
                        built = await client.call_tool("compile_document", {"path": "agent.tex"})
                        assert not built.is_error, built
                        assert built.structured_content["success"], built
                        pdf = await client.call_tool("get_pdf", {"build_id": built.structured_content["build_id"]})
                        assert base64.b64decode(pdf.structured_content["content_base64"]).startswith(b"%PDF-")
                        assert pdf.structured_content["url"].startswith(base_url)
                    sessions = await client.call_tool("list_editors", {})
                    assert sessions.structured_content == {"sessions": []}
                    resources = await client.list_resources()
                    assert any(str(resource.uri) == "nextex://workspace" for resource in resources.resources)
            asyncio.run(scenario())
        finally:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
