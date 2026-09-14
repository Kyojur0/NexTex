# Complete NexTex local editor

The user requested implementation of all remaining features and verification of a working complete product. The existing application and the preceding source review define the product: a local, single-user LaTeX editor with text and visual modes, file management, templates, PDF builds, history, and optional configured AI assistance. Preserve the current design. Do not add unrelated cloud collaboration, billing, or accounts.

## Required behavior

1. Open a local workspace and select/create/rename/delete files and folders with clear errors and safe confirmations. New blank files, five real templates, Open File and Save As work. Never overwrite an existing file silently or lose dirty edits during navigation.
2. Text editing supports undo, redo, find, replace, snippets, indentation, highlighting, and documented keyboard shortcuts. Main menu actions and shortcuts agree.
3. Visual editing supports paragraphs, headings, lists, math, figures, tables and code; rich formatting persists as LaTeX. Preserve preamble, document wrapper and untouched source. Unsupported constructs remain editable raw LaTeX rather than being silently discarded. Undo/redo and mode changes preserve edits. Table spans and imported assets survive round trips and compilation.
4. Saving is atomic on disk and tracks the revision actually saved. Detect external changes and preserve the unsaved buffer. Builds save the latest content first. Navigation, rename and deletion update document identity and preview consistently.
5. Background version history is independent of panel visibility, scoped by workspace and file, pruned, recoverable and clearly distinct from disk saves. Preserve browser-local recovery drafts for crashes/reloads.
6. The local backend rejects root mutation and path escapes, safely enumerates symlinks, limits asset uploads and serves assets safely. Compilation does not block unrelated requests, has bounded time/concurrency, supports multipass/bibliography documents, and returns useful mapped diagnostics and PDFs.
7. AI has validated inputs, clear configuration/connection errors, model selection and explicit review before replacing content. No embedded credentials or silent simulated success. Core editing works without an AI account or network.
8. Reproducible installation, startup, checks and test isolation. One canonical lockfile, working lint/typecheck/unit/E2E/build commands and CI. Upstream design synchronization cannot silently remove local product code.
9. Verify real browser workflows against a temporary workspace and real TeX compilation, desktop and narrow layouts, persistence/reload, failures and document fidelity. Preserve the user's modified sample resume and installer.

## Architecture

Keep FastAPI for local filesystem/compilers and Next.js for UI and AI. The Zustand store owns file identity, saved revisions, disk actions, build state and shared source undo/redo. Visual blocks own source-preserving block metadata. A mounted application hook owns autosave and history. Browser storage holds scoped history/recovery; source files remain authoritative on disk. Optional AI uses server configuration, with no requirement for cloud access to edit/build.

## Verification contract

Unit tests cover real invariants (round-trip preservation, revision races, history keys, input validation). Backend tests use temporary directories and real compiler smoke tests. Playwright launches isolated backend/frontend services, creates its own documents, and verifies saved disk content and valid PDFs alongside rendered interactions. A production build and a requirement-by-requirement audit are required before claiming completion.
