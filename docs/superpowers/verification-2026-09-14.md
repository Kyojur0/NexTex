# NexTex acceptance verification — 14 September 2026

Scope: the existing local single-user editor, as defined in the implementation spec.
Tests use temporary workspaces; the user's modified sample resume and installer are
excluded from mutation. Optional AI is exercised through a real local HTTP provider
fixture, not a paid remote provider account.

## Automated checks

- Root `npm run check`: TypeScript passes, ESLint has zero errors (two existing
  unused-type warnings in toast hooks), 128 frontend tests and 93 backend tests pass.
- Root `npm run build`: optimized Next.js production build passes with local fonts.
- `npm audit --omit=dev`: zero reported production vulnerabilities.
- `npm ls --depth=0`: installed frontend dependencies satisfy the manifest.
- `git diff --check`: passes.
- Production launcher smoke: frontend HTTP200, backend health, isolated workspace,
  and shutdown of both listening ports pass. Conflicting production API ports and
  occupied web ports fail before starting the wrong service.
- Active compiler shutdown: real temporary Uvicorn plus a long-running synthetic
  compiler/child group stopped in 1.128 seconds after SIGTERM.

## Requirement coverage

| Requirement | Verification evidence |
| --- | --- |
| Files and workspaces | Browser create, template, Open File, Save As, rename, canceled/confirmed delete, trusted folder switch and reload. Backend root/symlink/traversal and atomic-create tests. |
| Code editing | Unit command/snippet/indent tests; real browser find/replace, undo/redo, shortcuts and saved content. |
| Visual source fidelity | Exact-source unit tests for wrappers, comments, CRLF, unsupported raw syntax, code indentation, captions and table alignment. Browser mode changes and disk reload. |
| Formatting, tables and assets | Real browser rich formatting, caret formatting and partial removal; merged table round trips; validated image upload, stored bytes and real PDF compilation. |
| Safe saves and navigation | Deferred-write regression tests, revision conflicts, save-before-build, identity updates despite failed refresh, pending recovery locks and scoped source history. Browser external-change conflict preserves both versions. |
| History and recovery | IndexedDB scoping/dedup/pruning tests, closed-panel history recording, snapshot restore, real reload recovery and revision-safe draft handling. |
| Compilation | 93 backend tests including real installed pdfLaTeX/XeLaTeX/LuaLaTeX, latexmk/fallback references and bibliographies, worker responsiveness, deadlines and shutdown. Browser valid PDF bytes, rendered preview, download, diagnostics and corrected rebuild. |
| AI review | Input/origin/provider validation; real local HTTP request/response, reject/accept/save, truncated-result rejection, stale-source rejection and repeated-text selection targeting. |
| Runtime and delivery | Root setup/dev/build/start scripts, lockfile, local fonts, CI workflow, isolated Playwright servers and safe upstream design import. Desktop and narrow screenshots inspected. |

Browser acceptance: all 19 scenarios are verified. The full run passed 18/19; its
keyboard-reorder failure was fixed, followed by a clean rerun of all six affected
visual scenarios (34.8 seconds). The final frontend check passed 128 tests, and the
final production build passed after that fix. All affected checks are green.

Keyboard drag/drop uses one original registration per block; overlays and protected
document boundaries cannot receive drops. A regression covers this registration
invariant and the browser case verifies actual Space/ArrowDown/Space reordering,
undo/redo and editing-mode remount.

The built application is started through `npm start` at http://127.0.0.1:3000.
The optional AI endpoint reports unconfigured on this machine; provider setup is
documented in the root README and frontend/.env.example.

## Practical limits

- AI requires the user's configured provider and supported model; no remote account
  availability claim is made by the local fixture tests.
- This application serves trusted local workspaces on loopback. TeX has shell escape
  disabled but is not a full filesystem sandbox.
- Recovery/history live in the current browser profile; clearing its storage removes
  them. Files on disk are authoritative. Unknown LaTeX remains editable raw source.
- Compiler tests skip engines unavailable on another installation. All three engines
  were available and exercised on this machine.
