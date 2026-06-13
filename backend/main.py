"""
NexTex Backend API
Production-grade local filesystem + LaTeX compilation backend.
"""

import json
import os
import re
import shutil
import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="NexTex API",
    description="Backend API for NexTex – local file system + LaTeX compilation",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    # Local-only application: open CORS for any origin so the frontend
    # works via localhost, 127.0.0.1, or local network IP (e.g. 192.168.x.x).
    # The backend should never be exposed to untrusted networks.
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Configuration & workspace persistence
# ---------------------------------------------------------------------------

BACKEND_DIR = Path(__file__).parent.resolve()
REPO_ROOT = BACKEND_DIR.parent.resolve()
DEFAULT_ROOT = (REPO_ROOT / "tex_files").resolve()
CONFIG_PATH = BACKEND_DIR / ".nextex_config.json"

COMPILER_MAP = {
    "pdflatex": "pdflatex",
    "xetex": "xelatex",
    "luatex": "lualatex",
}

# Subdirectory inside active workspace where builds are stored
BUILD_SUBDIR = ".nextex_builds"
MAX_RETAINED_BUILDS = 20


def _load_config() -> dict[str, Any]:
    """Load persisted workspace configuration."""
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def _save_config(config: dict[str, Any]) -> None:
    """Persist workspace configuration atomically."""
    tmp_path = CONFIG_PATH.with_suffix(".tmp")
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
    tmp_path.replace(CONFIG_PATH)


def _get_active_workspace() -> Path:
    """Return the currently active workspace root, ensuring it exists."""
    cfg = _load_config()
    active = cfg.get("active_workspace")
    trusted = cfg.get("trusted_local_mode", False)

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


def _get_build_output_dir() -> Path:
    """Return the build output directory inside the active workspace."""
    workspace = _get_active_workspace()
    build_dir = workspace / BUILD_SUBDIR
    build_dir.mkdir(parents=True, exist_ok=True)
    return build_dir


def _is_path_inside(base: Path, candidate: Path) -> bool:
    """Robust check that candidate is inside base (after resolving symlinks)."""
    try:
        candidate.relative_to(base)
        return True
    except ValueError:
        return False


def _resolve_safe(relative: str) -> Path:
    """Resolve a relative path against the active workspace and ensure it stays inside."""
    workspace = _get_active_workspace()
    clean = relative.lstrip("/")
    # Prevent path traversal via .. even before resolving
    if ".." in clean.split("/"):
        raise HTTPException(status_code=403, detail="Path contains forbidden traversal")
    resolved = (workspace / clean).resolve()
    if not _is_path_inside(workspace, resolved):
        raise HTTPException(status_code=403, detail="Path escapes workspace directory")
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

def _cleanup_old_builds() -> None:
    """Remove oldest builds when count exceeds MAX_RETAINED_BUILDS."""
    build_dir = _get_build_output_dir()
    try:
        build_dirs = [d for d in build_dir.iterdir() if d.is_dir()]
    except OSError:
        return

    if len(build_dirs) <= MAX_RETAINED_BUILDS:
        return

    # Sort by modification time (oldest first)
    build_dirs.sort(key=lambda d: d.stat().st_mtime)
    to_remove = build_dirs[: len(build_dirs) - MAX_RETAINED_BUILDS]
    for old in to_remove:
        try:
            shutil.rmtree(old)
        except OSError:
            pass


def _parse_compile_logs(stdout: str, stderr: str) -> tuple[list[dict[str, str]], list[dict[str, Any]]]:
    """Parse pdflatex stdout/stderr into log entries and error line references.

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

        # Error lines start with "!"
        if line.startswith("!"):
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
    return {"status": "healthy"}


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
    except PermissionError:
        return nodes

    for entry in entries:
        # Intentionally skip hidden files and the build output directory
        if entry.name.startswith("."):
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
        content = target.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File is not valid UTF-8 text")
    return {"path": path, "content": content}


class WriteFileBody(BaseModel):
    path: str
    content: str


@app.post("/api/files/write")
async def write_file(body: WriteFileBody):
    """Write (create or overwrite) a text file."""
    target = _resolve_safe(body.path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(body.content, encoding="utf-8")
    return {"path": body.path, "message": "File saved"}


class CreateItemBody(BaseModel):
    path: str
    type: str  # "file" | "folder"


@app.post("/api/files/create")
async def create_item(body: CreateItemBody):
    """Create a new file or folder."""
    target = _resolve_safe(body.path)
    if target.exists():
        raise HTTPException(status_code=409, detail="Item already exists")

    if body.type == "folder":
        target.mkdir(parents=True, exist_ok=True)
    elif body.type == "file":
        target.parent.mkdir(parents=True, exist_ok=True)
        target.touch()
    else:
        raise HTTPException(status_code=400, detail="type must be 'file' or 'folder'")

    return {"path": body.path, "type": body.type, "message": "Created"}


class RenameBody(BaseModel):
    old_path: str
    new_path: str


@app.post("/api/files/rename")
async def rename_item(body: RenameBody):
    """Rename / move a file or folder."""
    src = _resolve_safe(body.old_path)
    dst = _resolve_safe(body.new_path)
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
    target = _resolve_safe(body.path)
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

class CompileBody(BaseModel):
    file_path: str
    compiler: str = "pdflatex"


# Packages that visual-editor blocks commonly need. The backend injects them
# only when the source actually uses the corresponding commands/environments
# and the package is not already loaded.
_PACKAGE_RULES = [
    ("amsmath", [r"\\begin\{equation\}", r"\\begin\{align\}", r"\\begin\{gather\}"]),
    ("graphicx", [r"\\includegraphics"]),
    ("listings", [r"\\begin\{lstlisting\}"]),
    ("array", [r"\\begin\{tabular\}"]),
    ("geometry", [r"\\usepackage\[.*\]\{geometry\}"]),  # keep; geometry is common
]


def _detect_missing_packages(content: str) -> list[str]:
    """Return package names the content appears to need but doesn't already load."""
    missing: list[str] = []
    for pkg, patterns in _PACKAGE_RULES:
        # Already loaded?
        if re.search(rf"\\usepackage\s*(?:\[[^\]]*\])?\s*\{{{re.escape(pkg)}\}}", content):
            continue
        # Required by content?
        for pat in patterns:
            if re.search(pat, content):
                missing.append(pkg)
                break
    return missing


def _preprocess_latex_content(content: str) -> str:
    """Ensure content can compile by injecting required packages or wrapping it."""
    has_documentclass = r"\\documentclass" in content

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
    """Compile a .tex file and return the build log + download id."""
    compiler_cmd = COMPILER_MAP.get(body.compiler)
    if not compiler_cmd:
        raise HTTPException(status_code=400, detail=f"Unknown compiler: {body.compiler}")

    source = _resolve_safe(body.file_path)
    if not source.exists():
        raise HTTPException(status_code=404, detail="Source file not found")
    if not source.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")

    build_id = str(uuid.uuid4())
    build_dir = _get_build_output_dir() / build_id
    build_dir.mkdir(parents=True, exist_ok=True)

    # Preprocess source so that visual-editor blocks compile even when the
    # original file is missing required packages (listings, graphicx, amsmath, ...).
    original_content = source.read_text(encoding="utf-8")
    processed_content = _preprocess_latex_content(original_content)
    temp_source = build_dir / source.name
    temp_source.write_text(processed_content, encoding="utf-8")

    try:
        result = subprocess.run(
            [
                compiler_cmd,
                "-interaction=nonstopmode",
                "-halt-on-error",
                f"-output-directory={build_dir}",
                str(temp_source),
            ],
            capture_output=True,
            text=True,
            timeout=60,
            cwd=str(source.parent),
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail=f"Compiler '{compiler_cmd}' not found on system. Install a TeX distribution.",
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Compilation timed out (60s)")

    pdf_name = source.stem + ".pdf"
    pdf_path = build_dir / pdf_name
    has_pdf = pdf_path.exists()

    parsed_logs, error_lines = _parse_compile_logs(result.stdout, result.stderr)

    if result.returncode == 0 and has_pdf:
        pdf_size = pdf_path.stat().st_size
        parsed_logs.append({
            "type": "success",
            "message": f"PDF generated successfully ({pdf_size / 1024:.1f} KB)",
        })
    elif result.returncode != 0:
        parsed_logs.append({
            "type": "error",
            "message": f"Compilation failed with exit code {result.returncode}",
        })

    # Cleanup old builds in background (best-effort)
    _cleanup_old_builds()

    return CompileResult(
        build_id=build_id,
        success=result.returncode == 0 and has_pdf,
        logs=parsed_logs,
        error_lines=error_lines,
        pdf_available=has_pdf,
        pdf_url=f"/api/compile/{build_id}/pdf" if has_pdf else None,
        build_dir=str(build_dir) if has_pdf else None,
    )


@app.get("/api/compile/{build_id}/pdf")
async def get_compiled_pdf(build_id: str):
    """Download the compiled PDF for a given build."""
    # Validate UUID format loosely to prevent directory traversal
    try:
        uuid.UUID(build_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid build id format")

    build_dir = _get_build_output_dir() / build_id
    if not build_dir.exists():
        raise HTTPException(status_code=404, detail="Build not found")

    pdfs = list(build_dir.glob("*.pdf"))
    if not pdfs:
        raise HTTPException(status_code=404, detail="No PDF found for this build")

    return FileResponse(
        path=str(pdfs[0]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{pdfs[0].name}"'},
    )
