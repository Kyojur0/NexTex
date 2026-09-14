"""Exercise NexTex tools through the real MCP protocol in a disposable workspace."""
import asyncio
import base64

import httpx
from mcp import Client
import main


def test_mcp_file_workflow_and_conflict(isolated_workspace):
    from mcp_server import ApiClient, create_mcp_server

    async def scenario():
        server = create_mcp_server(ApiClient(app=main.app))
        async with Client(server) as client:
            names = {tool.name for tool in (await client.list_tools()).tools}
            assert {"get_status", "list_files", "read_file", "write_file", "compile_document",
                    "list_editors", "read_editor", "edit_editor", "editor_action", "get_pdf"} <= names
            status = await client.call_tool("get_status", {})
            assert status.structured_content["workspace"]["workspace_root"] == str(isolated_workspace)
            created = await client.call_tool("create_file", {"path": "paper.tex", "content": "Hello π\n"})
            assert not created.is_error
            read = await client.call_tool("read_file", {"path": "paper.tex"})
            original = read.structured_content
            assert original["content"] == "Hello π\n"
            updated = await client.call_tool("write_file", {"path": "paper.tex", "content": "Updated\n",
                                                          "expected_revision": original["revision"]})
            assert not updated.is_error
            stale = await client.call_tool("write_file", {"path": "paper.tex", "content": "Overwrite",
                                                        "expected_revision": original["revision"]})
            assert stale.is_error
            assert "409" in stale.content[0].text
            assert (isolated_workspace / "paper.tex").read_text() == "Updated\n"
            missing_revision = await client.call_tool("write_file", {"path": "paper.tex", "content": "Bad"})
            assert missing_revision.is_error
            escaped = await client.call_tool("read_file", {"path": "../outside.tex"})
            assert escaped.is_error
            renamed = await client.call_tool("rename_path", {"old_path": "paper.tex", "new_path": "renamed.tex"})
            assert not renamed.is_error
            deleted = await client.call_tool("delete_path", {"path": "renamed.tex"})
            assert not deleted.is_error
            assert not (isolated_workspace / "renamed.tex").exists()

    asyncio.run(scenario())


def test_mcp_reports_backend_failure():
    from mcp_server import ApiClient, create_mcp_server

    async def scenario():
        async with Client(create_mcp_server(ApiClient("http://127.0.0.1:1"))) as client:
            result = await client.call_tool("get_status", {})
            assert result.is_error
            assert "Start NexTex" in result.content[0].text
    asyncio.run(scenario())


def test_mcp_http_protocol_and_host_guard(isolated_workspace):
    from fastapi.testclient import TestClient
    with TestClient(main.app, base_url="http://127.0.0.1:8000") as client:
        message = {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {
            "protocolVersion": "2025-03-26", "capabilities": {},
            "clientInfo": {"name": "nextex-test", "version": "1"}}}
        headers = {"Accept": "application/json, text/event-stream"}
        response = client.post("/mcp", json=message, headers=headers)
        assert response.status_code == 200, response.text
        assert response.json()["result"]["serverInfo"]["name"] == "NexTex"
        foreign = client.post("/mcp", json=message, headers={**headers, "Host": "evil.example"})
        assert foreign.status_code in {400, 403, 421}
        origin = client.post("/mcp", json=message, headers={**headers, "Origin": "https://evil.example"})
        assert origin.status_code == 403


def test_mcp_pdf_and_compile_contract(monkeypatch):
    from mcp_server import ApiClient, create_mcp_server

    def handle(request):
        if request.url.path == "/api/workspace":
            return httpx.Response(200, json={"workspace_root": "/tmp/example"})
        if request.url.path == "/api/compile":
            return httpx.Response(200, json={"build_id": "test-build", "success": True,
                "pdf_available": True, "pdf_url": "/api/compile/test-build/pdf", "logs": [], "error_lines": []})
        if request.url.path == "/api/compile/test-build/pdf":
            return httpx.Response(200, content=b"%PDF-1.7\nfixture", headers={"content-type": "application/pdf"})
        return httpx.Response(200, json={"sessions": []})

    async def scenario():
        api = ApiClient(transport=httpx.MockTransport(handle))
        async with Client(create_mcp_server(api)) as client:
            built = await client.call_tool("compile_document", {"path": "paper.tex"})
            assert built.structured_content["pdf_url"] == "http://127.0.0.1:8000/api/compile/test-build/pdf"
            pdf = await client.call_tool("get_pdf", {"build_id": "test-build"})
            assert base64.b64decode(pdf.structured_content["content_base64"]).startswith(b"%PDF")
    asyncio.run(scenario())


def test_mcp_disallows_nonlocal_backend():
    import pytest
    from mcp_server import ApiClient
    for url in ["http://example.com:8000", "http://user:pass@localhost", "http://127.0.0.1/other"]:
        with pytest.raises(ValueError):
            ApiClient(url)
