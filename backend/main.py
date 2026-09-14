"""
NexTex Backend API
Trusted local filesystem and LaTeX compilation backend.
"""

import base64
import binascii
import difflib
import hashlib
import io
import json
import os
import re
import signal
import shutil
import subprocess
import tempfile
import threading
import time
import uuid
import warnings
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlencode, urlsplit

import anyio
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from starlette.routing import Mount
from pydantic import BaseModel
from PIL import Image, UnidentifiedImageError
from mcp.server.transport_security import TransportSecuritySettings

from editor_bridge import create_editor_router
from mcp_server import ApiClient, create_mcp_server

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

@asynccontextmanager
async def _lifespan(app: FastAPI):
    with _COMPILER_PROCESSES_LOCK:
        _COMPILERS_SHUTTING_DOWN.clear()
    # A manager belongs to one lifespan (including repeated TestClient starts).
    mcp = create_mcp_server(ApiClient(os.getenv("NEXTEX_API_URL", "http://127.0.0.1:8000"), app=app))
    mcp_route.app = mcp.streamable_http_app(
        stateless_http=True, json_response=True, max_request_body_size=16 * 1024 * 1024,
        transport_security=TransportSecuritySettings(
            allowed_hosts=["127.0.0.1", "127.0.0.1:*", "localhost", "localhost:*", "[::1]", "[::1]:*"],
            allowed_origins=ALLOWED_ORIGINS,
        ),
    )
    editor_broker.start()
    async with mcp.session_manager.run():
        try:
            yield
        finally:
            # Stop work before the MCP manager waits for its tool tasks to exit.
            _shutdown_compilers()
            await editor_broker.close()


app = FastAPI(
    title="NexTex API",
    description="Backend API for NexTex – local file system + LaTeX compilation",
    version="1.0.0",
    lifespan=_lifespan,
)

def _allowed_origins() -> list[str]:
    defaults = ",".join(f"http://{host}:{port}" for host in ("localhost", "127.0.0.1") for port in (3000, 3001))
    origins = [value.strip().rstrip("/") for value in os.getenv("NEXTEX_ALLOWED_ORIGINS", defaults).split(",") if value.strip()]
    for origin in origins:
        parsed = urlsplit(origin)
        if (parsed.scheme not in {"http", "https"} or parsed.hostname not in {"localhost", "127.0.0.1", "::1"}
                or parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment):
            raise ValueError("NEXTEX_ALLOWED_ORIGINS must contain only localhost HTTP(S) origins")
    return origins


ALLOWED_ORIGINS = _allowed_origins()
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS,
                   allow_methods=["GET", "POST", "DELETE"],
                   allow_headers=["Content-Type", "Mcp-Session-Id", "Mcp-Protocol-Version",
                                  "Mcp-Method", "Mcp-Name", "Last-Event-ID"],
                   expose_headers=["Mcp-Session-Id"])

editor_router, editor_broker = create_editor_router(ALLOWED_ORIGINS)
app.include_router(editor_router)


@app.middleware("http")
async def reject_untrusted_origins(request: Request, call_next):
    # CORS alone only controls response visibility; reject foreign-origin writes too.
    origin = request.headers.get("origin")
    if origin and origin not in ALLOWED_ORIGINS:
        return JSONResponse(status_code=403, content={"detail": "This API only accepts the configured local frontend origins"})
    return await call_next(request)

# ---------------------------------------------------------------------------
# Configuration & workspace persistence
# ---------------------------------------------------------------------------

BACKEND_DIR = Path(__file__).parent.resolve()
REPO_ROOT = BACKEND_DIR.parent.resolve()
DEFAULT_ROOT = (REPO_ROOT / "tex_files").resolve()
CONFIG_PATH = Path(os.getenv("NEXTEX_CONFIG_PATH", str(BACKEND_DIR / ".nextex_config.json"))).expanduser().resolve()
if os.getenv("NEXTEX_WORKSPACE_ROOT"):
    DEFAULT_ROOT = Path(os.environ["NEXTEX_WORKSPACE_ROOT"]).expanduser().resolve()

COMPILER_MAP = {
    "pdflatex": "pdflatex",
    "xetex": "xelatex",
    "luatex": "lualatex",
}

# Subdirectory inside active workspace where builds are stored
BUILD_SUBDIR = ".nextex_builds"
MAX_RETAINED_BUILDS = 20
MAX_ASSET_BYTES = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000
IMAGE_TYPES = {".png": ("PNG", "image/png"), ".jpg": ("JPEG", "image/jpeg"),
               ".jpeg": ("JPEG", "image/jpeg"), ".gif": ("GIF", "image/gif"), ".webp": ("WEBP", "image/webp")}
_FILE_LOCK = threading.RLock()
_COMPILE_LOCK = threading.Lock()
_COMPILER_PROCESSES_LOCK = threading.Lock()
_COMPILER_PROCESSES: set[subprocess.Popen[str]] = set()
_COMPILERS_SHUTTING_DOWN = threading.Event()
COMPILE_TIMEOUT_SECONDS = 60


def _load_config() -> dict[str, Any]:
    """Load persisted workspace configuration."""
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                config = json.load(f)
                return config if isinstance(config, dict) else {}
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def _save_config(config: dict[str, Any]) -> None:
    """Persist workspace configuration atomically."""
    _atomic_write(CONFIG_PATH, json.dumps(config, indent=2).encode("utf-8"))


def _atomic_write(target: Path, content: bytes) -> None:
    """Replace a file only after its complete new contents reach disk."""
    target.parent.mkdir(parents=True, exist_ok=True)
    temp_name = None
    try:
        with tempfile.NamedTemporaryFile(dir=target.parent, prefix=".nextex-save-", delete=False) as tmp:
            temp_name = tmp.name
            tmp.write(content)
            tmp.flush()
            os.fsync(tmp.fileno())
        if target.exists():
            os.chmod(temp_name, target.stat().st_mode & 0o777)
        os.replace(temp_name, target)
    finally:
        if temp_name and os.path.exists(temp_name):
            os.unlink(temp_name)


def _create_file_exclusive(target: Path, content: bytes) -> None:
    """Install complete contents atomically without ever replacing an existing path."""
    target.parent.mkdir(parents=True, exist_ok=True)
    temp_name = None
    try:
        with tempfile.NamedTemporaryFile(dir=target.parent, prefix=".nextex-create-", delete=False) as tmp:
            temp_name = tmp.name
            tmp.write(content)
            tmp.flush()
            os.fsync(tmp.fileno())
        os.link(temp_name, target)
    except FileExistsError as exc:
        raise HTTPException(status_code=409, detail="Item already exists") from exc
    except OSError as exc:
        raise HTTPException(status_code=500, detail="Could not create file") from exc
    finally:
        if temp_name and os.path.exists(temp_name):
            os.unlink(temp_name)


def _get_active_workspace() -> Path:
    """Return the currently active workspace root, ensuring it exists."""
    cfg = _load_config()
    active = cfg.get("active_workspace")

    if active:
        active_path = Path(active).resolve()
        if active_path.exists() and active_path.is_dir():
            return active_path
        # Persisted path is invalid — fall through to default

    # Ensure default root exists
    DEFAULT_ROOT.mkdir(parents=True, exist_ok=True)
    _save_config({
        "active_workspace": str(DEFAULT_ROOT),
        "trusted_local_mode": False,
        "source": "default",
    })
    return DEFAULT_ROOT


def _get_build_output_dir(workspace: Optional[Path] = None) -> Path:
    """Return the build output directory inside the active workspace."""
    workspace = workspace or _get_active_workspace()
    build_dir = workspace / BUILD_SUBDIR
    if build_dir.is_symlink():
        raise HTTPException(status_code=403, detail="Build directory cannot be a symbolic link")
    build_dir.mkdir(parents=True, exist_ok=True)
    return build_dir


def _is_path_inside(base: Path, candidate: Path) -> bool:
    """Robust check that candidate is inside base (after resolving symlinks)."""
    try:
        candidate.relative_to(base)
        return True
    except ValueError:
        return False


def _resolve_safe(relative: str, *, workspace: Optional[Path] = None, mutation: bool = False) -> Path:
    """Resolve a relative path against the active workspace and ensure it stays inside."""
    workspace = workspace or _get_active_workspace()
    if "\x00" in relative or "\\" in relative:
        raise HTTPException(status_code=400, detail="Invalid path")
    clean = relative.lstrip("/")
    # Prevent path traversal via .. even before resolving
    if ".." in clean.split("/"):
        raise HTTPException(status_code=403, detail="Path contains forbidden traversal")
    if BUILD_SUBDIR in Path(clean).parts:
        raise HTTPException(status_code=403, detail="Build output is managed by NexTex")
    candidate = workspace
    for part in Path(clean).parts:
        candidate = candidate / part
        if candidate.is_symlink():
            raise HTTPException(status_code=403, detail="Symbolic links are not supported")
    resolved = (workspace / clean).resolve()
    if not _is_path_inside(workspace, resolved):
        raise HTTPException(status_code=403, detail="Path escapes workspace directory")
    if mutation and resolved == workspace:
        raise HTTPException(status_code=403, detail="The workspace root cannot be modified")
    return resolved


def _to_relative(path: Path) -> str:
    """Return a path relative to the active workspace."""
    workspace = _get_active_workspace()
    try:
        return path.relative_to(workspace).as_posix()
    except ValueError:
        return str(path)


# ---------------------------------------------------------------------------
# Build cleanup
# ---------------------------------------------------------------------------

def _cleanup_old_builds(workspace: Optional[Path] = None) -> None:
    """Remove oldest builds when count exceeds MAX_RETAINED_BUILDS."""
    try:
        build_dir = _get_build_output_dir(workspace)
        build_dirs = []
        for directory in build_dir.iterdir():
            if directory.is_symlink() or not directory.is_dir():
                continue
            try:
                uuid.UUID(directory.name)
                build_dirs.append((directory.stat().st_mtime, directory))
            except (ValueError, OSError):
                continue
    except (OSError, HTTPException):
        return

    if len(build_dirs) <= MAX_RETAINED_BUILDS:
        return

    # Sort by modification time (oldest first)
    build_dirs.sort(key=lambda item: item[0])
    to_remove = build_dirs[: len(build_dirs) - MAX_RETAINED_BUILDS]
    for _, old in to_remove:
        try:
            shutil.rmtree(old)
        except OSError:
            pass


def _parse_compile_logs(stdout: str, stderr: str) -> tuple[list[dict[str, str]], list[dict[str, Any]]]:
    r"""Parse pdflatex stdout/stderr into log entries and error line references.

    pdflatex error format:
        ! LaTeX Error: ...
        l.15 \somecommand
                   {argument}

    Warning format (inline line number):
        LaTeX Warning: ... on input line 23.
    """
    log_lines = stdout.splitlines() if stdout else []
    stderr_lines = stderr.splitlines() if stderr else []
    all_lines = log_lines + stderr_lines

    parsed_logs: list[dict[str, str]] = []
    error_lines: list[dict[str, Any]] = []

    i = 0
    while i < len(all_lines):
        line = all_lines[i]

        file_error = re.match(r"^(.+?\.(?:tex|sty|cls)):(\d+):\s*(.+)", line)
        if file_error:
            parsed_logs.append({"type": "error", "message": file_error[3]})
            error_lines.append({"file": file_error[1], "line": int(file_error[2]),
                                "message": file_error[3], "context": "", "severity": "error"})
        # Error lines start with "!" when the compiler does not supply a filename.
        elif line.startswith("!"):
            parsed_logs.append({"type": "error", "message": line})
            # Look ahead up to 6 lines for l.NNN reference.
            # pdflatex often inserts <inserted text>, <to be read again>, etc.
            # between the ! error and the l.N line.
            lookahead = i + 1
            consumed = 0
            while lookahead < len(all_lines) and consumed < 6:
                next_line = all_lines[lookahead]
                if not next_line.strip():
                    lookahead += 1
                    consumed += 1
                    continue
                match = re.search(r"^l\.(\d+)", next_line)
                if match:
                    line_num = int(match.group(1))
                    context = next_line[match.end():].strip()
                    error_lines.append({
                        "line": line_num,
                        "message": line[2:].strip(),  # strip "! " prefix
                        "context": context,
                        "severity": "error",
                    })
                    i = lookahead  # consume lines up to and including l.N
                    break
                # Stop scanning if we hit another ! or Output written
                if next_line.startswith("!") or "Output written" in next_line:
                    break
                lookahead += 1
                consumed += 1
        # Warning lines
        elif "Warning" in line or "warning" in line:
            parsed_logs.append({"type": "warning", "message": line})
            # Some warnings include inline line numbers
            warn_match = re.search(r"(?:on input line|line)\s+(\d+)", line, re.IGNORECASE)
            if warn_match:
                error_lines.append({
                    "line": int(warn_match.group(1)),
                    "message": line.strip(),
                    "context": "",
                    "severity": "warning",
                })
        # Success indicators
        elif "Output written" in line or "pages" in line.lower():
            parsed_logs.append({"type": "success", "message": line})

        i += 1

    return parsed_logs, error_lines


# ---------------------------------------------------------------------------
# Health / root
# ---------------------------------------------------------------------------

@app.get("/")
async def root():
    return {"message": "NexTex API is running"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "capabilities": _capabilities()}


def _capabilities() -> dict[str, Any]:
    return {
        "compilers": [{"id": name, "command": command, "available": shutil.which(command) is not None}
                      for name, command in COMPILER_MAP.items()],
        "latexmk": shutil.which("latexmk") is not None,
        "bibtex": shutil.which("bibtex") is not None,
        "biber": shutil.which("biber") is not None,
        "assets": {"max_bytes": MAX_ASSET_BYTES, "mime_types": sorted({item[1] for item in IMAGE_TYPES.values()})},
        "revision_conflicts": True,
        "mcp": {"endpoint": "/mcp", "transports": ["streamable-http", "stdio"], "live_editor": True},
    }


@app.get("/api/capabilities")
async def capabilities():
    return _capabilities()


# ---------------------------------------------------------------------------
# Workspace API
# ---------------------------------------------------------------------------

class SelectWorkspaceBody(BaseModel):
    path: str
    trusted: bool = False


class WorkspaceInfo(BaseModel):
    workspace_root: str
    trusted_local_mode: bool
    source: str  # "default" | "user-selected"


@app.get("/api/workspace", response_model=WorkspaceInfo)
async def get_workspace():
    """Return current workspace metadata."""
    workspace = _get_active_workspace()
    cfg = _load_config()
    return WorkspaceInfo(
        workspace_root=str(workspace),
        trusted_local_mode=cfg.get("trusted_local_mode", False),
        source=cfg.get("source", "default"),
    )


@app.post("/api/workspace/select", response_model=WorkspaceInfo)
async def select_workspace(body: SelectWorkspaceBody):
    """Select (and persist) a new active workspace."""
    requested = Path(body.path).expanduser().resolve()
    if not requested.exists():
        raise HTTPException(status_code=404, detail="Path does not exist")
    if not requested.is_dir():
        raise HTTPException(status_code=400, detail="Path is not a directory")

    # Determine if this is outside the default root
    is_default = _is_path_inside(DEFAULT_ROOT, requested) or requested == DEFAULT_ROOT

    if not is_default and not body.trusted:
        raise HTTPException(
            status_code=403,
            detail="Explicit trusted consent required to open folders outside the default root",
        )

    _save_config({
        "active_workspace": str(requested),
        "trusted_local_mode": not is_default,
        "source": "user-selected",
    })

    # Ensure build subdir exists
    (requested / BUILD_SUBDIR).mkdir(parents=True, exist_ok=True)

    return WorkspaceInfo(
        workspace_root=str(requested),
        trusted_local_mode=not is_default,
        source="user-selected",
    )


@app.post("/api/workspace/reset", response_model=WorkspaceInfo)
async def reset_workspace():
    """Reset workspace to the default root."""
    DEFAULT_ROOT.mkdir(parents=True, exist_ok=True)
    _save_config({
        "active_workspace": str(DEFAULT_ROOT),
        "trusted_local_mode": False,
        "source": "default",
    })
    return WorkspaceInfo(
        workspace_root=str(DEFAULT_ROOT),
        trusted_local_mode=False,
        source="default",
    )


# ---------------------------------------------------------------------------
# File-system API
# ---------------------------------------------------------------------------

class FileNode(BaseModel):
    id: str
    name: str
    type: str  # "file" | "folder"
    path: str  # relative path from active workspace
    children: Optional[list["FileNode"]] = None


def _build_tree(directory: Path, rel_prefix: str = "") -> list[FileNode]:
    """Recursively build a file tree rooted at *directory*."""
    nodes: list[FileNode] = []
    try:
        entries = sorted(directory.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower()))
    except OSError:
        return nodes

    for entry in entries:
        # Intentionally skip hidden files and the build output directory
        if entry.name.startswith(".") or entry.is_symlink():
            continue

        rel_path = f"{rel_prefix}/{entry.name}" if rel_prefix else entry.name

        if entry.is_dir():
            children = _build_tree(entry, rel_path)
            nodes.append(FileNode(
                id=f"folder-{rel_path}",
                name=entry.name,
                type="folder",
                path=rel_path,
                children=children,
            ))
        else:
            nodes.append(FileNode(
                id=f"file-{rel_path}",
                name=entry.name,
                type="file",
                path=rel_path,
            ))

    return nodes


@app.get("/api/files")
async def list_files(path: str = ""):
    """Return the recursive file tree from *path* (relative to active workspace)."""
    target = _resolve_safe(path)
    if not target.exists():
        raise HTTPException(status_code=404, detail="Directory not found")
    if not target.is_dir():
        raise HTTPException(status_code=400, detail="Path is not a directory")
    tree = _build_tree(target, path.strip("/"))
    return tree


@app.get("/api/files/read")
async def read_file(path: str):
    """Read the text content of a file."""
    target = _resolve_safe(path)
    if not target.exists():
        raise HTTPException(status_code=404, detail="File not found")
    if not target.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")
    # Reject obviously binary files by extension (defense in depth)
    BINARY_EXTENSIONS = {
        ".pdf", ".zip", ".tar", ".gz", ".bz2", ".xz", ".7z",
        ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".ico",
        ".exe", ".dll", ".so", ".dylib", ".bin",
    }
    if target.suffix.lower() in BINARY_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Binary files cannot be read as text")
    try:
        raw_content = target.read_bytes()
        content = raw_content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File is not valid UTF-8 text")
    return {"path": path, "content": content, "revision": hashlib.sha256(raw_content).hexdigest()}


class WriteFileBody(BaseModel):
    path: str
    content: str
    expected_revision: Optional[str] = None


@app.post("/api/files/write")
async def write_file(body: WriteFileBody):
    """Write (create or overwrite) a text file."""
    with _FILE_LOCK:
        target = _resolve_safe(body.path, mutation=True)
        if target.exists() and not target.is_file():
            raise HTTPException(status_code=400, detail="Path is not a file")
        revision = hashlib.sha256(target.read_bytes()).hexdigest() if target.exists() else None
        if body.expected_revision is not None and body.expected_revision != revision:
            raise HTTPException(status_code=409, detail={"message": "File changed on disk. Reload before saving.", "current_revision": revision})
        content = body.content.encode("utf-8")
        try:
            _atomic_write(target, content)
        except OSError as exc:
            raise HTTPException(status_code=500, detail="Could not save file; previous contents were preserved") from exc
    return {"path": body.path, "message": "File saved", "revision": hashlib.sha256(content).hexdigest()}


class CreateItemBody(BaseModel):
    path: str
    type: str  # "file" | "folder"
    content: str = ""


@app.post("/api/files/create")
async def create_item(body: CreateItemBody):
    """Create a new file or folder."""
    target = _resolve_safe(body.path, mutation=True)
    if target.exists():
        raise HTTPException(status_code=409, detail="Item already exists")

    if body.type == "folder":
        try:
            target.mkdir(parents=True, exist_ok=False)
        except FileExistsError:
            raise HTTPException(status_code=409, detail="Item already exists")
    elif body.type == "file":
        _create_file_exclusive(target, body.content.encode("utf-8"))
    else:
        raise HTTPException(status_code=400, detail="type must be 'file' or 'folder'")

    result = {"path": body.path, "type": body.type, "message": "Created"}
    if body.type == "file":
        result["revision"] = hashlib.sha256(body.content.encode("utf-8")).hexdigest()
    return result


class RenameBody(BaseModel):
    old_path: str
    new_path: str


@app.post("/api/files/rename")
async def rename_item(body: RenameBody):
    """Rename / move a file or folder."""
    src = _resolve_safe(body.old_path, mutation=True)
    dst = _resolve_safe(body.new_path, mutation=True)
    if not src.exists():
        raise HTTPException(status_code=404, detail="Source not found")
    if dst.exists():
        raise HTTPException(status_code=409, detail="Destination already exists")
    dst.parent.mkdir(parents=True, exist_ok=True)
    src.rename(dst)
    return {"old_path": body.old_path, "new_path": body.new_path, "message": "Renamed"}


class DeleteBody(BaseModel):
    path: str


@app.post("/api/files/delete")
async def delete_item(body: DeleteBody):
    """Delete a file or folder (recursively)."""
    target = _resolve_safe(body.path, mutation=True)
    if not target.exists():
        raise HTTPException(status_code=404, detail="Item not found")
    if target.is_dir():
        shutil.rmtree(target)
    else:
        target.unlink()
    return {"path": body.path, "message": "Deleted"}


# ---------------------------------------------------------------------------
# LaTeX compilation API
# ---------------------------------------------------------------------------

class UploadAssetBody(BaseModel):
    path: str
    content_base64: str


def _image_type(target: Path, data: bytes) -> str:
    expected = IMAGE_TYPES.get(target.suffix.lower())
    if expected is None:
        raise HTTPException(status_code=400, detail="Supported image formats are PNG, JPEG, GIF, and WebP")
    if len(data) > MAX_ASSET_BYTES:
        raise HTTPException(status_code=413, detail="Images must be at most 10 MiB")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as img:
                if img.format != expected[0]:
                    raise HTTPException(status_code=400, detail="Image contents do not match the filename extension")
                if img.width * img.height > MAX_IMAGE_PIXELS:
                    raise HTTPException(status_code=400, detail="Image dimensions are too large")
                img.verify()
            # JPEG verify() only checks its header. Decode the first frame too so
            # a damaged/truncated payload never becomes a persistent document asset.
            with Image.open(io.BytesIO(data)) as img:
                img.load()
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError, Image.DecompressionBombWarning, Image.DecompressionBombError) as exc:
        raise HTTPException(status_code=400, detail="Invalid or damaged image") from exc
    return expected[1]


@app.post("/api/assets/upload")
def upload_asset(body: UploadAssetBody):
    with _FILE_LOCK:
        target = _resolve_safe(body.path, mutation=True)
        if target.exists():
            raise HTTPException(status_code=409, detail="An asset already exists at this path")
        if len(body.content_base64) > ((MAX_ASSET_BYTES + 2) // 3) * 4:
            raise HTTPException(status_code=413, detail="Images must be at most 10 MiB")
        try:
            data = base64.b64decode(body.content_base64, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise HTTPException(status_code=400, detail="Image must be valid base64") from exc
        media_type = _image_type(target, data)
        if target.suffix.lower() in {".gif", ".webp"}:
            # TeX engines embed PNG/JPEG directly. Persist the first frame so that
            # browser previews and the eventual PDF refer to the same durable file.
            with Image.open(io.BytesIO(data)) as image:
                stream = io.BytesIO()
                image.convert("RGBA").save(stream, format="PNG")
                data = stream.getvalue()
            target = target.with_suffix(".png")
            media_type = _image_type(target, data)
        _create_file_exclusive(target, data)
        saved_path = _to_relative(target)
    return {"path": saved_path, "url": "/api/assets?" + urlencode({"path": saved_path}),
            "mime_type": media_type, "size": len(data)}


@app.get("/api/assets")
def get_asset(path: str):
    target = _resolve_safe(path)
    if not target.is_file():
        raise HTTPException(status_code=404, detail="Image not found")
    if target.stat().st_size > MAX_ASSET_BYTES:
        raise HTTPException(status_code=413, detail="Images must be at most 10 MiB")
    data = target.read_bytes()
    media_type = _image_type(target, data)
    return Response(content=data, media_type=media_type,
                    headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "no-cache"})

class CompileBody(BaseModel):
    file_path: str
    compiler: str = "pdflatex"


# Packages that visual-editor blocks commonly need. The backend injects them
# only when the source actually uses the corresponding commands/environments
# and the package is not already loaded.
_PACKAGE_RULES = [
    ("amsmath", [r"\\begin\{(?:equation|align|gather|multline|alignat)\*?\}"]),
    ("graphicx", [r"\\includegraphics"]),
    ("listings", [r"\\begin\{lstlisting\}"]),
    ("array", [r"\\begin\{tabular\}"]),
    ("multirow", [r"\\multirow(?:\[|\{)"]),
    ("hyperref", [r"\\href\{"]),
    ("geometry", [r"\\usepackage\[.*\]\{geometry\}"]),  # keep; geometry is common
]


def _detect_missing_packages(content: str) -> list[str]:
    """Return package names the content appears to need but doesn't already load."""
    content = re.sub(r"(?<!\\)%[^\n]*", "", content)
    loaded = {name.strip() for group in re.findall(r"\\usepackage\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}", content)
              for name in group.split(",")}
    missing: list[str] = []
    for pkg, patterns in _PACKAGE_RULES:
        # Already loaded?
        if pkg in loaded:
            continue
        # Required by content?
        for pat in patterns:
            if re.search(pat, content):
                missing.append(pkg)
                break
    return missing


def _preprocess_latex_content(content: str) -> str:
    """Ensure content can compile by injecting required packages or wrapping it."""
    has_documentclass = r"\documentclass" in content

    if not has_documentclass:
        # The user is probably working in the visual editor with no preamble.
        # Wrap the content in a minimal article template with required packages.
        packages = _detect_missing_packages(content)
        preamble = "\n".join(f"\\usepackage{{{pkg}}}" for pkg in packages)
        if preamble:
            preamble = "\n" + preamble + "\n"
        return (
            "\\documentclass[11pt]{article}\n"
            "\\usepackage[margin=1in]{geometry}\n"
            f"{preamble}"
            "\\begin{document}\n\n"
            f"{content}\n\n"
            "\\end{document}\n"
        )

    # Full document: inject missing packages right after \documentclass.
    missing = _detect_missing_packages(content)
    if not missing:
        return content

    package_lines = "\n".join(f"\\usepackage{{{pkg}}}" for pkg in missing)
    # Insert after the first \documentclass line.
    def replacer(match: re.Match) -> str:
        return f"{match.group(0)}\n{package_lines}"

    return re.sub(r"(\\documentclass(?:\[[^\]]*\])?\{[^}]+\})", replacer, content, count=1)


class CompileResult(BaseModel):
    build_id: str
    success: bool
    logs: list[dict[str, str]]
    error_lines: list[dict[str, Any]]
    pdf_available: bool
    pdf_url: Optional[str] = None
    build_dir: Optional[str] = None


@app.post("/api/compile", response_model=CompileResult)
async def compile_latex(body: CompileBody):
    """Keep disk/compiler work off the event loop; each build captures its workspace."""
    workspace = _get_active_workspace()
    return await anyio.to_thread.run_sync(_compile_latex_sync, body, workspace)


def _kill_compiler_group(process: subprocess.Popen[str]) -> None:
    try:
        if os.name == "posix":
            # Kill descendants even when the direct child has already exited.
            os.killpg(process.pid, signal.SIGKILL)
        else:
            process.kill()
    except ProcessLookupError:
        pass


def _shutdown_compilers() -> None:
    """Stop detached TeX groups and prevent a worker from starting its next pass."""
    with _COMPILER_PROCESSES_LOCK:
        _COMPILERS_SHUTTING_DOWN.set()
        for process in _COMPILER_PROCESSES:
            _kill_compiler_group(process)
    # The worker owns communicate/reaping; never race it by consuming its pipes here.


def _run_command(command: list[str], *, cwd: str, env: dict[str, str], timeout: float):
    """Bound the whole process group, including latexmk's child TeX processes."""
    with _COMPILER_PROCESSES_LOCK:
        if _COMPILERS_SHUTTING_DOWN.is_set():
            raise HTTPException(status_code=503, detail="The compiler service is shutting down")
        process = subprocess.Popen(command, cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                   text=True, errors="replace", start_new_session=True)
        _COMPILER_PROCESSES.add(process)
    try:
        try:
            stdout, stderr = process.communicate(timeout=timeout)
        except BaseException:
            _kill_compiler_group(process)
            process.communicate()
            raise
        return subprocess.CompletedProcess(command, process.returncode, stdout, stderr)
    finally:
        with _COMPILER_PROCESSES_LOCK:
            _COMPILER_PROCESSES.discard(process)


def _source_line_map(original: str, processed: str) -> dict[int, int]:
    original_lines, processed_lines = original.splitlines(), processed.splitlines()
    mapping = {}
    matcher = difflib.SequenceMatcher(a=original_lines, b=processed_lines, autojunk=False)
    for kind, old_start, old_end, new_start, new_end in matcher.get_opcodes():
        if kind == "equal":
            mapping.update({new_start + offset + 1: old_start + offset + 1 for offset in range(old_end - old_start)})
        elif kind == "replace" and old_end > old_start:
            # A command may share the documentclass line that receives an insertion.
            mapping.update({line + 1: min(old_start + (line - new_start), old_end - 1) + 1
                            for line in range(new_start, new_end)})
    return mapping


def _map_diagnostics(diagnostics: list[dict[str, Any]], source: Path, temp_source: Path,
                     workspace: Path, line_map: dict[int, int]) -> list[dict[str, Any]]:
    mapped = []
    for item in diagnostics:
        item = dict(item)
        reported = Path(item.get("file", str(temp_source)))
        if not reported.is_absolute():
            reported = source.parent / reported
        if reported.resolve() in {source.resolve(), temp_source.resolve()}:
            line = line_map.get(item["line"])
            if line is None:
                continue  # A generated preamble error stays in logs, with no false editor location.
            item["line"] = line
            item["file"] = source.relative_to(workspace).as_posix()
        elif _is_path_inside(workspace, reported.resolve()) and reported.is_file():
            item["file"] = reported.resolve().relative_to(workspace).as_posix()
        else:
            continue  # Installed package errors are not editable workspace locations.
        if item not in mapped:
            mapped.append(item)
    return mapped


def _compile_latex_sync(body: CompileBody, workspace: Path):
    compiler_cmd = COMPILER_MAP.get(body.compiler)
    if not compiler_cmd:
        raise HTTPException(status_code=400, detail=f"Unknown compiler: {body.compiler}")

    source = _resolve_safe(body.file_path, workspace=workspace)
    if not source.exists():
        raise HTTPException(status_code=404, detail="Source file not found")
    if not source.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")

    if source.suffix.lower() != ".tex":
        raise HTTPException(status_code=400, detail="Only .tex documents can be compiled")
    if not shutil.which(compiler_cmd):
        raise HTTPException(
            status_code=500,
            detail=f"Compiler '{compiler_cmd}' not found on system. Install a TeX distribution.",
        )
    if not _COMPILE_LOCK.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="Another compilation is in progress. Try again when it finishes.")
    try:
        build_id = str(uuid.uuid4())
        build_dir = _get_build_output_dir(workspace) / build_id
        build_dir.mkdir(parents=True, exist_ok=False)
        try:
            original_content = source.read_text(encoding="utf-8")
        except UnicodeDecodeError as exc:
            raise HTTPException(status_code=400, detail="Source is not valid UTF-8") from exc
        processed_content = _preprocess_latex_content(original_content)
        temp_source = build_dir / source.name
        temp_source.write_text(processed_content, encoding="utf-8")
        line_map = _source_line_map(original_content, processed_content)
        deadline = time.monotonic() + COMPILE_TIMEOUT_SECONDS
        environment = os.environ.copy()
        # Bibliography tools run in the output directory and still need the project files.
        for name in ("TEXINPUTS", "BIBINPUTS", "BSTINPUTS"):
            environment[name] = str(source.parent) + os.pathsep + environment.get(name, "")
        environment["shell_escape"] = "f"
        environment["openout_any"] = "p"
        # TeX otherwise wraps absolute filenames at 79 characters, destroying
        # file:line diagnostics for normal macOS temporary/build paths.
        environment["max_print_line"] = "10000"

        def run(command: list[str], cwd: Path = source.parent):
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise subprocess.TimeoutExpired(command, COMPILE_TIMEOUT_SECONDS)
            return _run_command(command, cwd=str(cwd), env=environment, timeout=remaining)

        latexmk = shutil.which("latexmk")
        options = ["-interaction=nonstopmode", "-halt-on-error", "-file-line-error", "-no-shell-escape"]
        if latexmk:
            mode = {"pdflatex": "-pdf", "xetex": "-xelatex", "luatex": "-lualatex"}[body.compiler]
            result = run([latexmk, "-norc", mode, *options, f"-outdir={build_dir}", str(temp_source)])
        else:
            command = [compiler_cmd, *options, f"-output-directory={build_dir}", str(temp_source)]
            result = run(command)
            if result.returncode == 0:
                aux = build_dir / (source.stem + ".aux")
                bcf = build_dir / (source.stem + ".bcf")
                bibliography = None
                if bcf.exists():
                    bibliography = "biber"
                elif aux.exists() and r"\bibdata" in aux.read_text(encoding="utf-8", errors="replace"):
                    bibliography = "bibtex"
                if bibliography:
                    binary = shutil.which(bibliography)
                    if not binary:
                        raise HTTPException(status_code=500, detail=f"Bibliography requires '{bibliography}', which is not installed")
                    result = run([binary, source.stem], cwd=build_dir)
                if result.returncode == 0:
                    # Two follow-up passes settle bibliography citations and cross references.
                    for _ in range(2):
                        result = run(command)
                        if result.returncode != 0:
                            break

        pdf_path = build_dir / (source.stem + ".pdf")
        has_pdf = pdf_path.is_file() and not pdf_path.is_symlink()
        # The final TeX log avoids stale warnings from latexmk's earlier passes.
        final_log = build_dir / (source.stem + ".log")
        log_text = final_log.read_text(encoding="utf-8", errors="replace") if final_log.is_file() else result.stdout
        parsed_logs, error_lines = _parse_compile_logs(log_text, result.stderr)
        if result.returncode != 0:
            stdout_logs, stdout_errors = _parse_compile_logs(result.stdout, "")
            for item in stdout_logs:
                if item["type"] == "error" and item not in parsed_logs:
                    parsed_logs.append(item)
            error_lines.extend(item for item in stdout_errors if item not in error_lines)
            parsed_logs.append({"type": "error", "message": f"Compilation failed with exit code {result.returncode}"})
        elif has_pdf:
            parsed_logs.append({"type": "success", "message": f"PDF generated successfully ({pdf_path.stat().st_size / 1024:.1f} KB)"})
        else:
            parsed_logs.append({"type": "error", "message": "Compiler finished without producing a PDF"})
        return CompileResult(build_id=build_id, success=result.returncode == 0 and has_pdf,
                             logs=parsed_logs[-2000:],
                             error_lines=_map_diagnostics(error_lines, source, temp_source, workspace, line_map),
                             pdf_available=has_pdf, pdf_url=f"/api/compile/{build_id}/pdf" if has_pdf else None,
                             build_dir=str(build_dir) if has_pdf else None)
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(status_code=504, detail=f"Compilation timed out ({COMPILE_TIMEOUT_SECONDS}s)") from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail="A required compiler or project file was not found") from exc
    finally:
        _cleanup_old_builds(workspace)
        _COMPILE_LOCK.release()


@app.get("/api/compile/{build_id}/pdf")
async def get_compiled_pdf(build_id: str):
    """Download the compiled PDF for a given build."""
    # Validate UUID format loosely to prevent directory traversal
    try:
        uuid.UUID(build_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid build id format")

    build_dir = _get_build_output_dir() / str(uuid.UUID(build_id))
    if build_dir.is_symlink():
        raise HTTPException(status_code=403, detail="Invalid build directory")
    if not build_dir.exists():
        raise HTTPException(status_code=404, detail="Build not found")

    pdfs = [path for path in build_dir.glob("*.pdf") if path.is_file() and not path.is_symlink()]
    if not pdfs:
        raise HTTPException(status_code=404, detail="No PDF found for this build")

    return FileResponse(
        path=str(pdfs[0]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{pdfs[0].name}"'},
    )


async def _mcp_not_started(scope, receive, send):
    await JSONResponse(status_code=503, content={"detail": "MCP requires the application lifespan"})(scope, receive, send)


# Keep this final: a root mount must follow all ordinary API routes.
mcp_route = Mount("/", app=_mcp_not_started)
app.router.routes.append(mcp_route)
