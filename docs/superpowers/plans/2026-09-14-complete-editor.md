# Complete NexTex Implementation Plan

> Execution: independent subsystem agents with parent integration and verification; implementation is authorized by the user's explicit request.

**Goal:** Complete and verify every existing local editor product flow.

**Architecture:** Source-preserving visual blocks feed the shared document store. Revision-aware atomic saves and isolated compiler jobs protect user files. UI commands, history and recovery share document identity.

**Tech Stack:** Next.js 16, React 19, Zustand, TypeScript, FastAPI, local TeX, Vitest, Pytest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-14-complete-editor-design.md`

## Tasks and ownership

- [x] Backend agent: `backend/**`. First reproduce root mutation, symlink traversal, write conflicts and compile mapping failures. Implement safe atomic CRUD; read/write SHA256 revisions; JSON image upload and asset serving; capabilities; bounded nonblocking multipass builds. Run Pytest and real compiler tests in temporary directories. Keep legacy API clients compatible.
- [x] Visual agent: `frontend/lib/visual-editor/**` plus visual-editor, block-canvas, block-renderer, latex-output-panel. First test wrapper/raw preservation, nested lists, tables and rich formatting. Implement source metadata/raw blocks, usable formatting and undo, immediate safe synchronization and asset import. Verify functional block operations and exact untouched source round trips.
- [x] UI agent: header, text editor, template modal, file tree and new template/find modules. First test real template creation, editor commands and destructive confirmation. Wire all menus via `editor:command`, createDocument and page callbacks. Preserve design and add accessible controls.
- [x] Parent: API/store/page/history/recovery/AI/settings/runtime. Reproduce save-in-flight edit, concurrent open, dirty navigation, build-before-save, scoped history and AI error handling. Implement serialized revision-aware saves, safe navigation, file dialogs, background history/drafts and consistent build/shortcut wiring.
- [x] Parent integration: npm as canonical manager; lint/typecheck/E2E commands, fonts without build network dependency, startup launcher, CI and safe upstream workflow. Document setup and configuration with executable commands.
- [x] Parent acceptance: run unit/backend/typecheck/lint/build. Launch isolated E2E services. Verify create/template/open/save-as/rename/delete, undo/redo/find/replace/snippets, text/visual switches, wrappers/tables/assets/rich text, history/reload/conflicts, configured AI success/error contract, real PDFs and errors. Capture desktop/narrow screenshots outside repository and inspect them.
- [x] Independent review: inspect final diff for missed controls and data-loss paths; repair findings and rerun affected tests. Audit each spec requirement against current evidence before completing goal.

## Integration contracts

- `readDocument(path) -> {content,revision}`; `writeFile(path,content,expectedRevision?) -> {revision}`; write conflicts throw status 409.
- `uploadAsset(path,base64) -> {path}`; `getAssetUrl(path)`; server limits to validated raster files.
- Store adds `createDocument(path,content)`, `saveAs(path)`, `isSaving`, `lastError`, `revision`. It owns dirty-file navigation and save-before-build.
- Header `onNewFile`, existing Open/SaveAs callbacks; text editor `documentId` scopes caret state; shared store source history resets at document identity boundaries. Menu event `editor:command` has command undo/redo/find/replace/insert with optional text.
- All tests use isolated temporary workspaces/config paths. The existing modified sample resume is excluded from writes and test fixtures.

## Completion evidence

All scoped requirements are implemented and verified. Final frontend check: 128 tests, TypeScript and zero ESLint errors. Backend: 93 tests. Production build passes. Browser acceptance: all 19 scenarios verified; the full run passed 18/19, followed by a fix and a clean rerun of all six affected visual cases (including the remaining keyboard-reorder case). Production launcher and active compiler shutdown verified. See `../verification-2026-09-14.md` for evidence and practical limits.
