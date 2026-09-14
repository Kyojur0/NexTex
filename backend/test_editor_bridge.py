"""The editor bridge routes commands to an authenticated, current browser session."""

from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
import hashlib
import time
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest
from starlette.websockets import WebSocketDisconnect

import editor_bridge
from editor_bridge import create_editor_router


ORIGIN = "http://localhost:3000"


@pytest.fixture
def bridge():
    router, broker = create_editor_router([ORIGIN])

    @asynccontextmanager
    async def lifespan(app):
        yield
        await broker.close()

    app = FastAPI(lifespan=lifespan)
    app.include_router(router)
    with TestClient(app, base_url="http://127.0.0.1") as client:
        yield client, broker


def snapshot(content="Hello 🌍", **overrides):
    return {
        "workspace_root": "/temporary/project", "path": "doc.tex", "content": content,
        "revision": "disk-revision", "is_modified": True, "mode": "text",
        "is_building": False, "is_saving": False, "is_navigating": False,
        "has_pending_draft": False, "can_undo": True, "can_redo": False,
        "pdf_url": None, "last_error": None, **overrides,
    }


def publish(socket, session_id, state=None):
    socket.send_json({"type": "state", "session_id": session_id, "state": state or snapshot()})


def wait_for_sessions(client, count):
    deadline = time.monotonic() + 2
    while time.monotonic() < deadline:
        response = client.get("/api/editor/sessions")
        assert response.status_code == 200
        sessions = response.json()["sessions"]
        if len(sessions) == count:
            return sessions
        time.sleep(0.005)
    pytest.fail(f"Expected {count} sessions, got {sessions}")


def test_registers_exact_live_source_and_server_hash_then_removes_disconnected_session(bridge):
    client, _ = bridge
    session_id = str(uuid4())
    with client.websocket_connect("ws://127.0.0.1/api/editor/connect", headers={"Origin": ORIGIN}) as socket:
        publish(socket, session_id)
        state = wait_for_sessions(client, 1)[0]
        assert state == {**snapshot(), "has_error": False, "build_logs": [], "error_lines": [], "session_id": session_id,
                         "content_sha256": hashlib.sha256(snapshot()["content"].encode()).hexdigest()}
    wait_for_sessions(client, 0)


@pytest.mark.parametrize("host,origin", [("evil.example", ORIGIN), ("localhost.evil.example", ORIGIN),
                                          ("127.0.0.1", "https://evil.example"), ("127.0.0.1", None)])
def test_rejects_websocket_foreign_host_or_origin(bridge, host, origin):
    client, _ = bridge
    headers = {"Host": host}
    if origin:
        headers["Origin"] = origin
    with pytest.raises(WebSocketDisconnect) as error:
        with client.websocket_connect("ws://127.0.0.1/api/editor/connect", headers=headers):
            pytest.fail("Untrusted websocket was accepted")
    assert error.value.code == 1008
    assert wait_for_sessions(client, 0) == []


def test_duplicate_registration_cannot_take_over_active_session(bridge):
    client, _ = bridge
    session_id = str(uuid4())
    with client.websocket_connect("ws://127.0.0.1/api/editor/connect", headers={"Origin": ORIGIN}) as owner:
        publish(owner, session_id)
        wait_for_sessions(client, 1)
        with client.websocket_connect("ws://127.0.0.1/api/editor/connect", headers={"Origin": ORIGIN}) as intruder:
            publish(intruder, session_id, snapshot("stolen"))
            with pytest.raises(WebSocketDisconnect) as error:
                intruder.receive_json()
            assert error.value.code == 1008
        assert wait_for_sessions(client, 1)[0]["content"] == "Hello 🌍"


def test_commands_pass_preconditions_and_return_validated_current_state(bridge):
    client, _ = bridge
    session_id = str(uuid4())
    args = {"content": "New source", "expected_content_sha256": "old hash",
            "expected_workspace_root": "/temporary/project", "expected_path": "doc.tex"}
    with client.websocket_connect("ws://127.0.0.1/api/editor/connect", headers={"Origin": ORIGIN}) as socket:
        publish(socket, session_id)
        wait_for_sessions(client, 1)
        with ThreadPoolExecutor() as executor:
            response = executor.submit(client.post, "/api/editor/command", json={"session_id": session_id, "action": "set_content", "args": args})
            command = socket.receive_json()
            assert command["type"] == "command"
            assert command["action"] == "set_content"
            assert command["args"] == args
            assert 0 < command["expires_at"] - time.time() * 1000 <= 70_000
            state = snapshot("New source", session_id=session_id, content_sha256="untrusted browser hash")
            socket.send_json({"type": "result", "id": command["id"], "ok": True, "state": state})
            result = response.result(timeout=2)
        assert result.status_code == 200
        assert result.json()["ok"] is True
        assert result.json()["state"]["content_sha256"] == hashlib.sha256(b"New source").hexdigest()
        assert wait_for_sessions(client, 1)[0] == result.json()["state"]


def test_command_rejection_returns_conflict_and_current_state(bridge):
    client, _ = bridge
    session_id = str(uuid4())
    with client.websocket_connect("ws://127.0.0.1/api/editor/connect", headers={"Origin": ORIGIN}) as socket:
        publish(socket, session_id)
        wait_for_sessions(client, 1)
        with ThreadPoolExecutor() as executor:
            response = executor.submit(client.post, "/api/editor/command", json={"session_id": session_id, "action": "save", "args": {}})
            command = socket.receive_json()
            socket.send_json({"type": "result", "id": command["id"], "ok": False,
                              "state": snapshot("User changed this"), "error": "Content changed; reread the editor"})
            result = response.result(timeout=2)
        assert result.status_code == 409
        assert result.json()["ok"] is False
        assert result.json()["error"] == "Content changed; reread the editor"
        assert result.json()["state"]["content"] == "User changed this"


def test_commands_serialize_per_session(bridge):
    client, _ = bridge
    session_id = str(uuid4())
    with client.websocket_connect("ws://127.0.0.1/api/editor/connect", headers={"Origin": ORIGIN}) as socket:
        publish(socket, session_id)
        wait_for_sessions(client, 1)
        with ThreadPoolExecutor() as executor:
            first = executor.submit(client.post, "/api/editor/command", json={"session_id": session_id, "action": "save", "args": {}})
            first_command = socket.receive_json()
            second = executor.submit(client.post, "/api/editor/command", json={"session_id": session_id, "action": "read", "args": {}})
            # Reading on another thread proves no second dispatch until the first result.
            second_dispatch = executor.submit(socket.receive_json)
            time.sleep(0.05)
            assert not second_dispatch.done()
            socket.send_json({"type": "result", "id": first_command["id"], "ok": True, "state": snapshot()})
            assert first.result(timeout=2).status_code == 200
            second_command = second_dispatch.result(timeout=2)
            socket.send_json({"type": "result", "id": second_command["id"], "ok": True, "state": snapshot()})
            assert second.result(timeout=2).status_code == 200


def test_timeout_requires_reread_and_late_result_does_not_replace_snapshot(bridge):
    client, broker = bridge
    broker.command_timeout_seconds = 0.08
    session_id = str(uuid4())
    with client.websocket_connect("ws://127.0.0.1/api/editor/connect", headers={"Origin": ORIGIN}) as socket:
        publish(socket, session_id)
        wait_for_sessions(client, 1)
        with ThreadPoolExecutor() as executor:
            response = executor.submit(client.post, "/api/editor/command", json={"session_id": session_id, "action": "build", "args": {}})
            command = socket.receive_json()
            result = response.result(timeout=2)
        assert result.status_code == 504
        assert "reread" in result.json()["detail"].lower()
        socket.send_json({"type": "result", "id": command["id"], "ok": True, "state": snapshot("late")})
        # A subsequent read command/reply is also a barrier for the ignored late result.
        with ThreadPoolExecutor() as executor:
            response = executor.submit(client.post, "/api/editor/command", json={"session_id": session_id, "action": "read", "args": {}})
            command = socket.receive_json()
            assert wait_for_sessions(client, 1)[0]["content"] == "Hello 🌍"
            socket.send_json({"type": "result", "id": command["id"], "ok": True, "state": snapshot()})
            assert response.result(timeout=2).status_code == 200


def test_disconnect_rejects_waiting_command_promptly(bridge):
    client, _ = bridge
    session_id = str(uuid4())
    with ThreadPoolExecutor() as executor:
        with client.websocket_connect("ws://127.0.0.1/api/editor/connect", headers={"Origin": ORIGIN}) as socket:
            publish(socket, session_id)
            wait_for_sessions(client, 1)
            response = executor.submit(client.post, "/api/editor/command", json={"session_id": session_id, "action": "save", "args": {}})
            socket.receive_json()
        assert response.result(timeout=2).status_code == 404


@pytest.mark.parametrize("bad_state", [snapshot(content=None), snapshot(is_modified="false"), snapshot(mode="unsafe")])
def test_invalid_state_is_never_registered(bridge, bad_state):
    client, _ = bridge
    with client.websocket_connect("ws://127.0.0.1/api/editor/connect", headers={"Origin": ORIGIN}) as socket:
        publish(socket, str(uuid4()), bad_state)
        with pytest.raises(WebSocketDisconnect) as error:
            socket.receive_json()
        assert error.value.code == 1008
    wait_for_sessions(client, 0)


def test_result_cannot_impersonate_another_session(bridge):
    client, _ = bridge
    session_id = str(uuid4())
    with client.websocket_connect("ws://127.0.0.1/api/editor/connect", headers={"Origin": ORIGIN}) as socket:
        publish(socket, session_id)
        wait_for_sessions(client, 1)
        with ThreadPoolExecutor() as executor:
            response = executor.submit(client.post, "/api/editor/command", json={"session_id": session_id, "action": "read", "args": {}})
            command = socket.receive_json()
            socket.send_json({"type": "result", "id": command["id"], "ok": True,
                              "state": snapshot("wrong session", session_id=str(uuid4()))})
            with pytest.raises(WebSocketDisconnect) as error:
                socket.receive_json()
            assert error.value.code == 1008
            assert response.result(timeout=2).status_code == 404


def test_unknown_action_and_missing_session_are_rejected(bridge):
    client, _ = bridge
    assert client.post("/api/editor/command", json={"session_id": str(uuid4()), "action": "delete", "args": {}}).status_code == 422
    assert client.post("/api/editor/command", json={"session_id": str(uuid4()), "action": "read", "args": {}}).status_code == 404


def test_close_rejects_pending_commands_and_closes_sockets(bridge):
    client, broker = bridge
    session_id = str(uuid4())
    with client.websocket_connect("ws://127.0.0.1/api/editor/connect", headers={"Origin": ORIGIN}) as socket:
        publish(socket, session_id)
        wait_for_sessions(client, 1)
        with ThreadPoolExecutor() as executor:
            response = executor.submit(client.post, "/api/editor/command", json={"session_id": session_id, "action": "save", "args": {}})
            socket.receive_json()
            client.portal.call(broker.close)
            with pytest.raises(WebSocketDisconnect) as error:
                socket.receive_json()
            assert error.value.code == 1001
            assert response.result(timeout=2).status_code == 404
    wait_for_sessions(client, 0)


def test_socket_capacity_includes_unregistered_connections(bridge):
    client, broker = bridge
    broker.max_sessions = 1
    with client.websocket_connect("ws://127.0.0.1/api/editor/connect", headers={"Origin": ORIGIN}):
        with pytest.raises(WebSocketDisconnect) as error:
            with client.websocket_connect("ws://127.0.0.1/api/editor/connect", headers={"Origin": ORIGIN}):
                pytest.fail("Connection limit was not enforced")
        assert error.value.code == 1013


@pytest.mark.parametrize("limit,content,code", [("MAX_MESSAGE_BYTES", "x" * 256, 1009),
                                              ("MAX_CONTENT_BYTES", "🌍" * 5, 1008)])
def test_message_and_source_byte_limits(bridge, monkeypatch, limit, content, code):
    client, _ = bridge
    monkeypatch.setattr(editor_bridge, limit, 16)
    with client.websocket_connect("ws://127.0.0.1/api/editor/connect", headers={"Origin": ORIGIN}) as socket:
        publish(socket, str(uuid4()), snapshot(content))
        with pytest.raises(WebSocketDisconnect) as error:
            socket.receive_json()
        assert error.value.code == code
    wait_for_sessions(client, 0)


@pytest.mark.parametrize("session_id", ["not-a-uuid", None, 123, str(uuid4()).upper()])
def test_registration_requires_canonical_uuid(bridge, session_id):
    client, _ = bridge
    with client.websocket_connect("ws://127.0.0.1/api/editor/connect", headers={"Origin": ORIGIN}) as socket:
        publish(socket, session_id)
        with pytest.raises(WebSocketDisconnect) as error:
            socket.receive_json()
        assert error.value.code == 1008
    wait_for_sessions(client, 0)


def test_state_update_cannot_switch_session_identity(bridge):
    client, _ = bridge
    with client.websocket_connect("ws://127.0.0.1/api/editor/connect", headers={"Origin": ORIGIN}) as socket:
        publish(socket, str(uuid4()))
        wait_for_sessions(client, 1)
        publish(socket, str(uuid4()), snapshot("another editor"))
        with pytest.raises(WebSocketDisconnect) as error:
            socket.receive_json()
        assert error.value.code == 1008
    wait_for_sessions(client, 0)


def test_native_http_reads_are_allowed_but_untrusted_hosts_and_origins_are_rejected(bridge):
    client, _ = bridge
    assert client.get("/api/editor/sessions").status_code == 200
    assert client.get("/api/editor/sessions", headers={"Origin": "https://evil.example"}).status_code == 403
    assert client.get("/api/editor/sessions", headers={"Host": "evil.example"}).status_code == 403
    assert client.post("/api/editor/command", headers={"Origin": "https://evil.example"},
                       json={"session_id": str(uuid4()), "action": "read", "args": {}}).status_code == 403


def test_disconnect_rejects_queued_commands_too(bridge):
    client, _ = bridge
    session_id = str(uuid4())
    with ThreadPoolExecutor() as executor:
        with client.websocket_connect("ws://127.0.0.1/api/editor/connect", headers={"Origin": ORIGIN}) as socket:
            publish(socket, session_id)
            wait_for_sessions(client, 1)
            first = executor.submit(client.post, "/api/editor/command", json={"session_id": session_id, "action": "save", "args": {}})
            socket.receive_json()
            second = executor.submit(client.post, "/api/editor/command", json={"session_id": session_id, "action": "read", "args": {}})
        assert first.result(timeout=2).status_code == 404
        assert second.result(timeout=2).status_code == 404


def test_another_socket_cannot_complete_owners_command(bridge):
    client, _ = bridge
    owner_id, other_id = str(uuid4()), str(uuid4())
    with client.websocket_connect("ws://127.0.0.1/api/editor/connect", headers={"Origin": ORIGIN}) as owner:
        publish(owner, owner_id)
        wait_for_sessions(client, 1)
        with client.websocket_connect("ws://127.0.0.1/api/editor/connect", headers={"Origin": ORIGIN}) as other:
            publish(other, other_id, snapshot("other content"))
            wait_for_sessions(client, 2)
            with ThreadPoolExecutor() as executor:
                response = executor.submit(client.post, "/api/editor/command", json={"session_id": owner_id, "action": "save", "args": {}})
                command = owner.receive_json()
                other.send_json({"type": "result", "id": command["id"], "ok": True, "state": snapshot("impostor")})
                time.sleep(0.025)
                assert not response.done()
                assert next(state for state in wait_for_sessions(client, 2) if state["session_id"] == other_id)["content"] == "other content"
                owner.send_json({"type": "result", "id": command["id"], "ok": True, "state": snapshot()})
                assert response.result(timeout=2).json()["state"]["content"] == "Hello 🌍"


@pytest.mark.parametrize("origin", ["https://evil.example", "http://localhost.evil.example:3000", "http://localhost:3000/path"])
def test_factory_rejects_nonlocal_or_nonorigin_allowlist_values(origin):
    with pytest.raises(ValueError):
        create_editor_router([origin])
