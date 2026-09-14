"""A process-local relay to live browser editors; it never writes workspace files."""

import asyncio
from dataclasses import dataclass, field
import hashlib
import json
import time
import anyio
from typing import Any, Literal
from urllib.parse import urlsplit
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError


MAX_MESSAGE_BYTES = 16 * 1024 * 1024
MAX_CONTENT_BYTES = 8 * 1024 * 1024
MAX_SESSIONS = 16
COMMAND_TIMEOUT_SECONDS = 70.0
Action = Literal["read", "open", "set_content", "save", "save_as", "build", "undo", "redo", "set_mode"]


class _EditorState(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")

    workspace_root: str | None
    path: str | None
    content: str
    revision: str | None
    is_modified: bool
    mode: Literal["text", "visual"]
    is_building: bool
    is_saving: bool
    is_navigating: bool
    has_pending_draft: bool
    can_undo: bool
    can_redo: bool
    pdf_url: str | None
    last_error: str | None
    has_error: bool = False
    build_logs: list[dict[str, Any]] = Field(default_factory=list)
    error_lines: list[dict[str, Any]] = Field(default_factory=list)


class _CommandBody(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")

    session_id: str
    action: Action
    args: dict[str, Any] = Field(default_factory=dict)


@dataclass
class _Session:
    session_id: str
    socket: WebSocket
    state: dict[str, Any]
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    pending: dict[str, asyncio.Future] = field(default_factory=dict)
    connected: bool = True


def _valid_session_id(value: Any) -> str:
    if not isinstance(value, str) or str(UUID(value)) != value:
        raise ValueError("session_id must be a canonical UUID")
    return value


def _snapshot(value: Any, session_id: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError("state must be an object")
    value = dict(value)
    if "session_id" in value and value.pop("session_id") != session_id:
        raise ValueError("state belongs to another session")
    value.pop("content_sha256", None)  # Browser-supplied hashes are never trusted.
    state = _EditorState.model_validate(value).model_dump()
    content_bytes = state["content"].encode("utf-8")
    if len(content_bytes) > MAX_CONTENT_BYTES:
        raise ValueError("Editor content exceeds the bridge limit")
    return {**state, "session_id": session_id, "content_sha256": hashlib.sha256(content_bytes).hexdigest()}


def _loopback_host(host: str | None) -> bool:
    if not host or any(character in host for character in "/\\?#@"):
        return False
    try:
        parsed = urlsplit("//" + host)
        # Accessing port also rejects malformed ports and unmatched IPv6 brackets.
        port = parsed.port
        return parsed.hostname in {"localhost", "127.0.0.1", "::1"} and (port is None or 0 < port < 65536)
    except ValueError:
        return False


class EditorBroker:
    """All methods run on the application's event loop; commands serialize per tab."""

    def __init__(self, allowed_origins: list[str]):
        for origin in allowed_origins:
            parsed = urlsplit(origin)
            if (parsed.scheme not in {"http", "https"} or not _loopback_host(parsed.netloc)
                    or parsed.path or parsed.query or parsed.fragment):
                raise ValueError("Editor origins must be localhost HTTP(S) origins")
        self.allowed_origins = set(allowed_origins)
        self.command_timeout_seconds = COMMAND_TIMEOUT_SECONDS
        self.max_sessions = MAX_SESSIONS
        self._sessions: dict[str, _Session] = {}
        self._sockets: set[WebSocket] = set()
        self._closed = False

    def sessions(self) -> list[dict[str, Any]]:
        return [dict(session.state) for session in self._sessions.values() if session.connected]

    def start(self) -> None:
        self._closed = False

    def _disconnect(self, session: _Session) -> None:
        session.connected = False
        if self._sessions.get(session.session_id) is session:
            del self._sessions[session.session_id]
        for pending in session.pending.values():
            if not pending.done():
                pending.set_exception(HTTPException(status_code=404, detail="Editor session disconnected; reread the session list"))
        session.pending.clear()

    async def close(self) -> None:
        self._closed = True
        for session in list(self._sessions.values()):
            self._disconnect(session)
        sockets = list(self._sockets)
        self._sockets.clear()
        await asyncio.gather(*(socket.close(code=1001, reason="Editor bridge shutting down") for socket in sockets), return_exceptions=True)

    async def connect(self, socket: WebSocket) -> None:
        # Browser sockets must have both a trusted Origin and a loopback Host.
        if (self._closed or not _loopback_host(socket.headers.get("host"))
                or socket.headers.get("origin") not in self.allowed_origins):
            await socket.close(code=1008, reason="Only the configured local frontend can connect")
            return
        if len(self._sockets) >= self.max_sessions:
            await socket.close(code=1013, reason="Too many editor sessions")
            return
        self._sockets.add(socket)
        session = None
        try:
            await socket.accept()
            while not self._closed:
                raw = await socket.receive_text()
                if self._closed:
                    return
                if len(raw.encode("utf-8")) > MAX_MESSAGE_BYTES:
                    await socket.close(code=1009, reason="Editor message exceeds the bridge limit")
                    return
                message = json.loads(raw)
                if not isinstance(message, dict):
                    raise ValueError("Editor message must be an object")
                if message.get("type") == "state":
                    session_id = _valid_session_id(message.get("session_id"))
                    if session is not None and session.session_id != session_id:
                        raise ValueError("Cannot change session identity on a connection")
                    state = _snapshot(message.get("state"), session_id)
                    if session is None:
                        if session_id in self._sessions:
                            raise ValueError("Editor session is already connected")
                        session = _Session(session_id, socket, state)
                        self._sessions[session_id] = session
                    else:
                        session.state = state
                elif message.get("type") == "result":
                    if session is None:
                        raise ValueError("Register an editor state before sending results")
                    if "session_id" in message and message["session_id"] != session.session_id:
                        raise ValueError("Result belongs to another session")
                    command_id = message.get("id")
                    if not isinstance(command_id, str):
                        raise ValueError("Result id must be a string")
                    pending = session.pending.get(command_id)
                    if pending is None or pending.done():
                        continue  # Timed-out/unknown results cannot overwrite the last state.
                    state = _snapshot(message.get("state"), session.session_id)
                    if not isinstance(message.get("ok"), bool):
                        raise ValueError("Result ok must be a boolean")
                    error = message.get("error")
                    if error is not None and not isinstance(error, str):
                        raise ValueError("Result error must be a string")
                    session.state = state
                    result = {"ok": message["ok"], "state": state}
                    if error is not None:
                        result["error"] = error
                    elif not result["ok"]:
                        result["error"] = "Editor rejected the command; reread its current state"
                    pending.set_result(result)
                else:
                    raise ValueError("Unknown editor message type")
        except WebSocketDisconnect:
            pass
        except (ValueError, ValidationError, KeyError, UnicodeError):
            await socket.close(code=1008, reason="Invalid editor message or session identity")
        finally:
            if session is not None:
                self._disconnect(session)
            self._sockets.discard(socket)

    async def command(self, session_id: str, action: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
        # Also validate direct broker calls, for the stdio MCP adapter.
        try:
            body = _CommandBody.model_validate({"session_id": session_id, "action": action, "args": args if args is not None else {}})
            _valid_session_id(body.session_id)
        except (ValueError, ValidationError) as error:
            raise HTTPException(status_code=422, detail="Invalid editor command") from error
        session = self._sessions.get(body.session_id)
        if session is None or not session.connected or self._closed:
            raise HTTPException(status_code=404, detail="Editor session is not connected; reread the session list")
        command_id = str(uuid4())
        expires_at = int(time.time() * 1000 + self.command_timeout_seconds * 1000)
        message = {"type": "command", "id": command_id, "action": body.action, "args": body.args, "expires_at": expires_at}
        try:
            if len(json.dumps(message, ensure_ascii=False, allow_nan=False).encode("utf-8")) > MAX_MESSAGE_BYTES:
                raise HTTPException(status_code=413, detail="Editor command exceeds the bridge limit")
        except (ValueError, TypeError, UnicodeError) as error:
            raise HTTPException(status_code=422, detail="Editor command arguments must be valid JSON") from error
        try:
            with anyio.fail_after(self.command_timeout_seconds):
                async with session.lock:
                    if not session.connected or self._closed:
                        raise HTTPException(status_code=404, detail="Editor session disconnected; reread the session list")
                    pending = asyncio.get_running_loop().create_future()
                    session.pending[command_id] = pending
                    try:
                        await session.socket.send_json(message)
                        return await pending
                    except (WebSocketDisconnect, RuntimeError, OSError) as error:
                        self._disconnect(session)
                        raise HTTPException(status_code=404, detail="Editor session disconnected; reread the session list") from error
                    finally:
                        session.pending.pop(command_id, None)
                        if not pending.done():
                            pending.cancel()
                        elif not pending.cancelled():
                            pending.exception()  # Consume disconnect errors even when socket.send failed.
        except TimeoutError as error:
            raise HTTPException(status_code=504, detail="Editor command timed out and may have completed. Reread the editor state before retrying.") from error


def create_editor_router(allowed_origins: list[str]) -> tuple[APIRouter, EditorBroker]:
    broker = EditorBroker(allowed_origins)
    router = APIRouter(prefix="/api/editor", tags=["editor"])

    def guard(request: Request) -> None:
        origin = request.headers.get("origin")
        if not _loopback_host(request.headers.get("host")) or (origin is not None and origin not in broker.allowed_origins):
            raise HTTPException(status_code=403, detail="Editor bridge accepts only trusted localhost requests")

    @router.websocket("/connect")
    async def connect(socket: WebSocket):
        await broker.connect(socket)

    @router.get("/sessions")
    async def sessions(request: Request):
        guard(request)
        return {"sessions": broker.sessions()}

    @router.post("/command")
    async def command(request: Request, body: _CommandBody):
        guard(request)
        result = await broker.command(body.session_id, body.action, body.args)
        return JSONResponse(status_code=200 if result["ok"] else 409, content=result)

    return router, broker
