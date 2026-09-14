# Overleaf Visual Editor Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement the independent units, followed by integrated verification.

**Goal:** Match Overleaf's continuous visual writing experience while retaining NexTex styling.

**Architecture:** CodeMirror owns the editing surface with original LaTeX as its document. A conservative scanner creates visual decorations; pure editing commands produce local source transactions. React controls and dialogs dispatch those transactions while Zustand retains document lifecycle ownership.

**Tech Stack:** Next.js, React, TypeScript, CodeMirror 6, KaTeX, Zustand, Vitest and Playwright.

**Spec:** ../specs/2026-09-14-overleaf-visual-editor.md

## Global Constraints

- Never rewrite unrelated source or modify user resume files.
- Preserve save/build, recovery, undo/redo and MCP contracts.
- Unknown LaTeX stays editable; use scoped visual styling and NexTex identity.
- All offsets use original LaTeX, as defined in frontend/lib/visual-source/types.ts.

## Task 1: Conservative source scanner

Files: frontend/lib/visual-source/scanner.ts and scanner.test.ts.

Interface: `scanVisualSource(source: string): VisualSpan[]`. Produce style spans, hidden delimiters and atomic preview spans using original offsets. Recognize balanced groups, escaped characters, comments, document boundaries, headings, lists, supported inline commands, math, references, figures and simple tables. Malformed and unsupported constructs remain visible as code.

- [x] Add cases for nested formatting, escaped percent/dollars, comments and verbatim, and untouched unknown macros.
- [x] Implement scanning without modifying source; validate every range and preserve unknown input.
- [x] Run focused scanner tests.

## Task 2: Source editing commands

Files: frontend/lib/visual-source/commands.ts and commands.test.ts.

Interfaces: `formatSource(source, selection, format): SourceEdit`; `setHeading(source, selection, level): SourceEdit`; `toggleList(source, selection, ordered): SourceEdit`; `continueList(source, selection): SourceEdit | null`; `insertSource(source, selection, latex): SourceEdit`. Types come from types.ts.

- [x] Test wrap/unwrap, collapsed selection, multi-paragraph formatting, selected prose to list, continuation and empty-item exit.
- [x] Implement local edits that preserve surrounding preamble and commands.
- [x] Verify exact output and resulting cursor offsets.

## Task 3: Toolbar and structured editing dialogs

Files: frontend/components/editor/visual-source/toolbar.tsx and insert-dialog.tsx.

Toolbar uses formatting and heading/list callbacks, undo/redo, find and InsertKind actions. Dialog receives SourceDialogRequest and returns LaTeX to replace its captured range. Provide equation preview, image path/caption, editable simple table, link, citation/reference and symbol choices. Source fallback must always be available for existing constructs that cannot be safely represented by fields.

- [x] Implement accessible compact controls with focus-preserving pointer behavior.
- [x] Add structured insert/edit forms with labels, Cancel/Apply and keyboard dismissal.
- [x] Verify form output and unsupported source preservation.

## Task 4: Continuous editor integration and style

Files: frontend/components/editor/visual-editor.tsx; frontend/lib/visual-source/decorations.ts; frontend/app/globals.css; dependency manifests.

- [x] Install official CodeMirror packages and locally bundled Noto Serif.
- [x] Build direct StateField decorations for block replacements and atomic ranges; connect widget activation to source dialogs.
- [x] Connect commands and source updates to Zustand, mapping selection across external changes and preventing feedback loops.
- [x] Use NexTex's existing colors and controls around continuous serif content and inline source affordances.

## Task 5: Integrated verification and delivery

- [x] Update visual interaction tests for continuous editing, source preservation, dialogs and external updates.
- [x] Run frontend check, backend regression checks, production build and relevant browser tests.
- [x] Inspect desktop and narrow views and correct visual/interaction defects.
- [x] Update brief usage notes and screenshot.
Delivery target: commit feature files and push `main` using existing authorization.

## Verification — 14 September 2026

- Frontend typecheck and 203 tests pass; lint has no errors and two existing toast warnings.
- Backend regression suite: 132 tests pass.
- Full Playwright suite: 22 tests pass. After the final insertion guard fix, all eight visual-editor browser tests pass again. Three new integration tests cover Select All insertion and formatting boundaries.
- Root production build passes. Desktop and 390px browser screenshots show the real compiled PDF, with no horizontal overflow or browser errors. The README visual screenshot is updated.
- Advanced package-specific syntax remains editable source; the PDF provides exact typesetting.
