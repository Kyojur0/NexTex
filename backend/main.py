import os
import uuid
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

app = FastAPI(
    title="NexTex API",
    description="Backend API for NexTex – local file system + LaTeX compilation",
    version="0.1.0",
)

# CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BASE_DIR = Path("/Users/haroonayaz/Desktop/projects/NexTex/backend/stuff")
# Ensure the base directory exists on startup
BASE_DIR.mkdir(parents=True, exist_ok=True)

COMPILER_MAP = {
    "pdflatex": "pdflatex",
    "xetex": "xelatex",
    "luatex": "lualatex",
}

# Keep compiled PDFs in a temp area so the frontend can fetch them
BUILD_OUTPUT_DIR = Path(tempfile.gettempdir()) / "nextex_builds"
BUILD_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def _resolve_safe(relative: str) -> Path:
    """Resolve a relative path against BASE_DIR and ensure it stays inside."""
    clean = relative.lstrip("/")
    resolved = (BASE_DIR / clean).resolve()
    if not str(resolved).startswith(str(BASE_DIR.resolve())):
        raise HTTPException(status_code=403, detail="Path escapes base directory")
    return resolved


# ---------------------------------------------------------------------------
# Health / root
# ---------------------------------------------------------------------------

@app.get("/")
async def root():
    return {"message": "NexTex API is running"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/api/config")
async def get_config():
    """Return current base directory and available compilers."""
    return {
        "baseDir": str(BASE_DIR),
        "compilers": list(COMPILER_MAP.keys()),
    }


# ---------------------------------------------------------------------------
# File-system API
# ---------------------------------------------------------------------------

class FileNode(BaseModel):
    id: str
    name: str
    type: str  # "file" | "folder"
    path: str  # relative path from BASE_DIR
    children: Optional[list["FileNode"]] = None


def _build_tree(directory: Path, rel_prefix: str = "") -> list[FileNode]:
    """Recursively build a file tree rooted at *directory*."""
    nodes: list[FileNode] = []
    try:
        entries = sorted(directory.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower()))
    except PermissionError:
        return nodes

    for entry in entries:
        # Skip hidden files
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
    """Return the recursive file tree from *path* (relative to BASE_DIR)."""
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
    try:
        content = target.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File is not a text file")
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
    path: str  # e.g. "project/new-file.tex" or "project/subfolder"
    type: str  # "file" | "folder"


@app.post("/api/files/create")
async def create_item(body: CreateItemBody):
    """Create a new file or folder."""
    target = _resolve_safe(body.path)
    if target.exists():
        raise HTTPException(status_code=409, detail="Item already exists")

    if body.type == "folder":
        target.mkdir(parents=True, exist_ok=True)
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.touch()

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
    file_path: str  # relative path to the .tex file inside BASE_DIR
    compiler: str = "pdflatex"  # pdflatex | xelatex | lualatex


@app.post("/api/compile")
async def compile_latex(body: CompileBody):
    """Compile a .tex file and return the build log + download id."""
    # Validate compiler
    compiler_cmd = COMPILER_MAP.get(body.compiler)
    if not compiler_cmd:
        raise HTTPException(status_code=400, detail=f"Unknown compiler: {body.compiler}")

    # Resolve source file
    source = _resolve_safe(body.file_path)
    if not source.exists():
        raise HTTPException(status_code=404, detail="Source file not found")
    if not source.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")

    # Create a build id and output directory
    build_id = str(uuid.uuid4())
    build_dir = BUILD_OUTPUT_DIR / build_id
    build_dir.mkdir(parents=True, exist_ok=True)

    # Run the compiler (in the source file's directory so \\input works)
    try:
        result = subprocess.run(
            [
                compiler_cmd,
                "-interaction=nonstopmode",
                "-halt-on-error",
                f"-output-directory={build_dir}",
                str(source),
            ],
            capture_output=True,
            text=True,
            timeout=60,
            cwd=str(source.parent),
        )
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail=f"Compiler '{compiler_cmd}' not found on system")
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Compilation timed out (60s)")

    # Look for the PDF
    pdf_name = source.stem + ".pdf"
    pdf_path = build_dir / pdf_name
    has_pdf = pdf_path.exists()

    # Parse log for errors/warnings
    log_lines = result.stdout.splitlines() if result.stdout else []
    stderr_lines = result.stderr.splitlines() if result.stderr else []
    all_lines = log_lines + stderr_lines

    parsed_logs = []
    for line in all_lines:
        if line.startswith("!"):
            parsed_logs.append({"type": "error", "message": line})
        elif "Warning" in line or "warning" in line:
            parsed_logs.append({"type": "warning", "message": line})
        elif "Output written" in line or "pages" in line.lower():
            parsed_logs.append({"type": "success", "message": line})

    # Always include a summary
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

    return {
        "build_id": build_id,
        "success": result.returncode == 0 and has_pdf,
        "logs": parsed_logs,
        "pdf_available": has_pdf,
    }


@app.get("/api/compile/{build_id}/pdf")
async def get_compiled_pdf(build_id: str):
    """Download the compiled PDF for a given build."""
    build_dir = BUILD_OUTPUT_DIR / build_id
    if not build_dir.exists():
        raise HTTPException(status_code=404, detail="Build not found")

    # Find the PDF
    pdfs = list(build_dir.glob("*.pdf"))
    if not pdfs:
        raise HTTPException(status_code=404, detail="No PDF found for this build")

    return FileResponse(
        path=str(pdfs[0]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{pdfs[0].name}"'},
    )
