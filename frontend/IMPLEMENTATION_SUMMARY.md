# NexTex implementation map

The root README documents installation and user workflows. This file maps runtime
ownership for developers; verification evidence is in `docs/superpowers/` at repo root.

## Source and persistence

`lib/store.ts` owns the active workspace/file, source string, saved source/revision,
serialized saves, navigation lock, source undo/redo, compilation, and UI settings.
All edits use `setContent`; it computes dirty state and records a browser recovery
draft. Undo/redo share exact source snapshots across both modes. File identity changes
reset transient source history. Save conflicts preserve the unsaved buffer.

`lib/drafts.ts` keys recovery by both workspace and path. `lib/version-db.ts` stores
IndexedDB snapshots under that same identity, serializes automatic snapshot creation,
deduplicates content, prunes old automatic versions, and moves history after rename.
`hooks/use-document-lifecycle.ts` owns autosave, quiet-period and periodic snapshots,
and the unsaved-change reload warning. The history panel is not the persistence owner.

## Editor and UI

`app/page.tsx` mounts lifecycle hooks and composes the header, dialogs, file/history
sidebar, selected editing mode, PDF preview, diagnostics, and recovery/error status.
The file-operation lock and recovery decision make the editor inert when needed.
`components/editor/header.tsx` dispatches text/visual commands and opens file/settings
flows. `file-dialogs.tsx`, `file-tree.tsx`, and `template-modal.tsx` call shared store
operations; `lib/templates.ts` contains standalone compilable templates.

`enhanced-code-editor.tsx` owns caret/selection and code input behavior, while source
history belongs to the store. `find-replace.tsx` provides literal search/replacement.
`visual-editor.tsx` owns a continuous CodeMirror 6 surface whose document is the original
LaTeX. `lib/visual-source/scanner.ts` supplies conservative source ranges for styled
text, hidden delimiters, and preview widgets. `decorations.ts` uses direct state-field
decorations and atomic ranges. Unsupported syntax remains editable source.

`commands.ts` creates local formatting, heading and list transactions; `edit-guard.ts`
protects concealed formatting and document boundaries when visible selections cross
them. Store changes from undo, mode switches and MCP map into the existing editor.
The toolbar and insert dialogs live in `components/editor/visual-source/`.

The earlier block parser and figure/table plugins are retained for structured dialogs
and previews. They serialize only the explicitly edited construct. Untouched source
is never reconstructed from the visual DOM. Dialog application rejects stale source.

Figures upload through the backend, store returned document-relative asset paths, and
avoid overwriting newer edits when an upload resolves. Table data tracks spanning and
hidden cells; insert/delete/merge operations maintain that grid before serialization.

## Services

`lib/api.ts` defines backend requests and structured errors. `backend/main.py` owns
workspace confinement, atomic revision-aware file writes, validated raster assets,
compiler capabilities, and bounded worker-thread builds with source diagnostics.
`smart-terminal.tsx` displays mapped issues and navigates to their source file/line.
`pdf-preview.tsx` embeds the browser PDF viewer and downloads compiled bytes.

`app/api/ai/suggest/route.ts` validates same-origin requests and bounded inputs, checks
server configuration, and invokes a configured gateway or OpenAI-compatible provider.
It validates completion output and returns explicit errors for missing configuration,
provider failure, empty/truncated output, or invalid requests. `ai-spotlight.tsx` captures
request source and selection, previews differences, and rejects stale replacements.

## Tooling

Next.js/React/TypeScript with Tailwind, Zustand, Radix primitives, dnd-kit, and KaTeX.
Fonts are packaged locally. `eslint.config.mjs`, Vitest, backend Pytest and Playwright
cover contracts and product flows. `playwright.config.ts` starts isolated services and
uses temporary workspaces. Root `scripts/build.mjs` records the API port compiled into
the production bundle; `scripts/run.mjs` launches and stops both local services and
checks build/port compatibility. CI runs checks, build and browser acceptance tests.
