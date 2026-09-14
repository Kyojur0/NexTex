# NexTex

NexTex is a local LaTeX editor with code and visual editing, filesystem workspaces,
PDF compilation, document history, recovery drafts, and optional AI suggestions.
The Next.js interface talks to a loopback FastAPI service that manages files and TeX.

## Run

Prerequisites: Node.js 22.12 or newer (Node 24 is used in CI), Python 3.10 or newer,
and a TeX distribution with `pdflatex`, `xelatex`, or `lualatex` on your PATH.
Install `latexmk` and BibTeX/Biber for bibliography documents. On macOS, MacTeX
provides these tools; on Linux, use your distribution's TeX Live packages.

From this directory:

```sh
npm run setup
npm run dev
```

Open **http://127.0.0.1:3000**. Ctrl+C stops both services. The default document
folder is `tex_files`; **File → Open Folder** selects another absolute local path.
The app asks you to trust a folder outside its default workspace. Keep the app
bound to loopback and compile trusted documents: TeX is not a filesystem sandbox.

For a production build:

```sh
npm run build
npm start
```

`NEXTEX_WEB_PORT` changes the interface port. `NEXTEX_API_PORT` changes the API port.
The API address is compiled into the browser bundle, so set the API port during
`npm run build` as well as development startup. `npm start` reads that build's API
port and rejects a conflicting override rather than connecting to the wrong service.

```sh
NEXTEX_WEB_PORT=3002 NEXTEX_API_PORT=8002 npm run dev
NEXTEX_API_PORT=8002 npm run build
NEXTEX_WEB_PORT=3002 npm start
```

Workspace/config overrides for isolated runs are `NEXTEX_WORKSPACE_ROOT` and
`NEXTEX_CONFIG_PATH`. Set both to avoid reusing your saved workspace selection.
The launcher sets matching loopback origins for the chosen web port. Backend
contracts and compiler behavior are documented in [backend/README.md](../backend/README.md).

## Editing

- File menus provide blank documents, five templates, Open File, Save, and Save As.
  The file tree creates files/folders, renames them, and confirms deletion.
- Code mode supports highlighting, indentation, find/replace, snippets, and undo/redo.
  Visual mode is a continuous writing surface with headings, formatting and lists.
  Click equations, figures or tables to edit them; use the toolbar to insert new ones.
  Both modes share document source and undo history.
- Visual round trips retain document boundaries, comments, preamble, and untouched
  source. Unsupported constructs remain editable LaTeX within the document. Rich formatting is
  stored as LaTeX; necessary formatting packages are added when used.
- Figure uploads accept PNG/JPEG/GIF/WebP, up to 10 MiB and 40 million pixels.
  GIF/WebP are converted to a static PNG for TeX. Assets are stored next to the
  document in `assets/`; upload errors remain visible.
- Build saves the latest source, runs the selected compiler, and displays the PDF
  and diagnostic links. References/bibliographies use `latexmk`, or a bounded fallback.
  PDF controls provide fit, zoom, dark viewing, collapse, and download.
- Autosave runs after two seconds of inactivity when enabled. External modifications
  cause a conflict instead of an overwrite; save a copy or reload from disk.
- Recovery drafts are written to browser storage while editing. On reopening a file,
  choose Recover or Discard before editing. Version history records opens/saves,
  edits after ten seconds of inactivity, and a two-minute checkpoint; manual and
  starred snapshots are available. These browser-local records are not backups and
  are removed if you clear browser storage. Undo history resets when changing files.

| Shortcut | Action |
| --- | --- |
| Cmd/Ctrl+S | Save (and build if enabled in Settings) |
| Cmd/Ctrl+Shift+S | Save As |
| Cmd/Ctrl+B | Bold in the Visual document; Build elsewhere |
| Cmd/Ctrl+N | New blank document |
| Cmd/Ctrl+O | Open folder |
| Cmd/Ctrl+Shift+O | Open file |
| Cmd/Ctrl+Z / Shift+Z | Undo / redo |
| Cmd/Ctrl+F / H | Find / replace |
| Cmd/Ctrl+K | AI assistant |

In Visual mode, Enter continues a list and a second Enter exits an empty final item.
Use the LaTeX toggle for a source panel, or click Preamble to edit document setup.
Advanced package-specific layouts remain source; the compiled PDF is the final layout.

## Optional AI

Core editing and compilation work without an AI service. Copy
`frontend/.env.example` to `frontend/.env.local` and configure one option:

- `AI_GATEWAY_API_KEY` for the AI SDK gateway, using its provider/model identifiers.
- `NEXTEX_AI_BASE_URL` for an OpenAI-compatible `/v1` API, plus
  `NEXTEX_AI_API_KEY` when required. HTTPS is required except for loopback servers.

Settings shows configuration status and lets you enter the model identifier your
provider accepts. Restart the frontend after configuration changes. When you request
an edit, the current document and selected passage are sent to the configured provider.
Review the suggestion and explicitly accept it; stale suggestions are rejected if
source or selection changes. Credentials remain on the server. Automated AI tests use
a local fixture; your own provider's availability and model support depend on its setup.

## Verification and development

```sh
npm run check                  # TypeScript, ESLint, Vitest, backend Pytest
npm run build                  # Offline-font production build
cd frontend
npx playwright install chromium
cd ..
npm run test:e2e                # Starts isolated backend, frontend, and mock AI
```

Browser tests use ports 3011/8011/8012 and fresh OS temporary directories. They verify
real disk files and PDFs without modifying `tex_files` or the normal backend config.
TeX integration tests skip unavailable engines; install all three engines to exercise
all compiler cases. CI installs dependencies and TeX, then runs checks/build/browser tests.

`frontend/package-lock.json` is the canonical dependency lockfile; use npm. Local fonts
avoid build-time font downloads. The upstream design workflow opens a reviewable PR in
`docs/design-upstream/`; it cannot overwrite the active frontend. See
[frontend/IMPLEMENTATION_SUMMARY.md](../frontend/IMPLEMENTATION_SUMMARY.md) for the code map.
