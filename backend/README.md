# NexTex local backend

Run from this directory with one Uvicorn worker:

```sh
python3 -m venv venv
venv/bin/python -m pip install -r requirements.txt
venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

A local TeX distribution supplies `pdflatex`, `xelatex`, and/or `lualatex`.
`latexmk` is preferred for references and bibliographies. Without it, NexTex
runs a first engine pass, BibTeX or Biber when requested by the output, and two
further engine passes. The complete job has a 60-second deadline. Only one build
runs at a time; another compile request receives HTTP 409. Compilation runs in
a worker thread, so health checks and file operations remain available.

## Local configuration

- `NEXTEX_WORKSPACE_ROOT`: default document directory (otherwise `../tex_files`).
- `NEXTEX_CONFIG_PATH`: workspace-selection JSON (otherwise `.nextex_config.json`).
- `NEXTEX_ALLOWED_ORIGINS`: comma-separated local HTTP(S) origins. Defaults to
  `http://localhost:3000`, `http://localhost:3001`, and their `127.0.0.1` equivalents.
  Only `localhost`, `127.0.0.1`, and `::1` hosts are accepted.

Use **both** workspace and config overrides when testing, to avoid selecting the
normal saved workspace. No workspace/configuration files are created on import.

This is a trusted local application. Keep it bound to loopback. Foreign browser
origins are rejected before routes run, including mutation requests, but local
clients without an Origin header are allowed. There are no accounts or remote
access credentials. Workspace trust consent is a local UX decision, not an
authentication mechanism. TeX runs with shell escape disabled, and latexmk does
not load rc files. TeX itself is not a filesystem sandbox; compile trusted sources.

## File and image contracts

`GET /api/files/read?path=...` returns `{path, content, revision}` where `revision`
is the SHA-256 hash of the exact UTF-8 file bytes. `POST /api/files/write` accepts
`{path, content, expected_revision?}` and returns `{path, message, revision}`.
Omitting the revision, or passing null, retains unconditional save compatibility.
A stale non-null revision returns HTTP 409 with
`{detail: {message, current_revision}}`; the file is preserved. Writes use atomic
replacement. Optimistic checks serialize this process's writes, but cannot lock
out unrelated programs editing a file at exactly the same moment.

`POST /api/files/create` accepts `{path, type: "file"|"folder", content?}`. Initial
file contents are installed atomically without overwriting existing paths, even
if another writer creates the destination during the operation. File creation
also returns `revision`. Delete and rename cannot target the workspace root.
Symbolic links and the internal `.nextex_builds` directory cannot be addressed by
file operations; listing skips hidden entries and symbolic links.

`POST /api/assets/upload` accepts `{path, content_base64}` and returns
`{path, url, mime_type, size}`. Payloads must be valid PNG, JPEG, GIF, or WebP,
at most 10 MiB and 40 million pixels. Images are verified and decoded before
being saved. GIF/WebP are converted to a PNG of the first frame for TeX
compatibility. **Store the returned path**, which can therefore differ from the
requested extension. Existing destinations are never overwritten.
`GET /api/assets?path=...` serves the validated image with `nosniff`; returned
asset URLs are relative to the backend origin.

## Builds and diagnostics

`POST /api/compile` accepts `{file_path, compiler?}` with compiler IDs `pdflatex`,
`xetex`, or `luatex`. It compiles the saved file. The API adds common missing
packages (including `multirow`) and can wrap document fragments, without
modifying the source. Output is retained under `.nextex_builds/<UUID>` in the
workspace captured when the job starts. At most 20 recent build directories
are retained, including after a failed or timed-out compiler job.

The compile response retains `{build_id, success, logs, error_lines,
pdf_available, pdf_url, build_dir}`. Diagnostic entries include a workspace-relative
`file` and original source `line` when these are known. Generated-preamble and
installed-package errors remain in logs without misleading editor line numbers.
`GET /api/compile/<UUID>/pdf` looks up builds in the active workspace.

`GET /api/capabilities` reports available compiler IDs/commands, `latexmk`,
`bibtex`, `biber`, asset limits, and revision-conflict support. `GET /health`
returns `{status: "healthy", capabilities: ...}`.

## Tests

```sh
venv/bin/python -m pytest -q
```

All tests patch configuration and workspace paths to pytest temporary
directories. Integration tests use real installed TeX tools and skip when their
required executables are absent. Tests never compile or write the user's
`tex_files` documents or active configuration.
