# NexTex — Frontend

Next.js frontend for NexTex, a local-first LaTeX editor with a visual block
editor, code editor, file tree, live PDF preview, and a collapsible build-log
terminal.

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript**
- **Zustand** for global state (`lib/store.ts`)
- **Tailwind CSS v4** + **shadcn/ui** components
- **DM Sans** (UI) + **JetBrains Mono** (code) — Fable5 warm parchment design
- **@dnd-kit** for drag-to-reorder blocks
- **KaTeX** for math rendering
- **Framer Motion** for block animations
- **Vitest** + **Playwright** for testing

## Design system

Warm parchment palette: `#F7F5F0` bg · `#C44528` burnt-orange accent · `#FFFFFF` page card.
Dark mode: `#211E1A` bg · `#E05838` accent. All tokens in `app/globals.css`.

## Structure

```
app/
  globals.css                 Design tokens (light + dark, palette overrides)
  layout.tsx                  Font setup (DM Sans + JetBrains Mono)
  page.tsx                    Editor shell — layout, shortcuts, autosave
  api/ai/suggest/             AI suggestion API route

components/editor/
  header.tsx                  App header — logo, file menus, build button
  file-tree.tsx               Sidebar file navigator
  editor-tab-bar.tsx          Code / Visual mode switcher
  enhanced-code-editor.tsx    LaTeX code editor with syntax highlighting
  visual-editor.tsx           Visual block editor + formatting toolbar wiring
  block-canvas.tsx            DnD canvas — white page card on parchment bg
  block-renderer.tsx          Per-block frame — left-border accent, drag handle,
                              floating type chip + dup/delete on select
  latex-output-panel.tsx      Live LaTeX panel with syntax highlighting + LIVE badge
  pdf-preview.tsx             Collapsible PDF preview
  smart-terminal.tsx          Build-log terminal (collapsible)
  ai-spotlight.tsx            ⌘K AI assistant modal
  template-modal.tsx          New-from-template picker
  advanced-settings.tsx       Settings panel
  version-history.tsx         Document version history

lib/visual-editor/
  parser.ts                   LaTeX → blocks
  serializer.ts               Blocks → LaTeX
  plugins/
    paragraph.tsx             Georgia serif 16.5px / 1.68 lh
    section.tsx               Section / subsection / subsubsection headings
    math.tsx                  KaTeX display equations with number column
    figure.tsx                Image upload (file picker + drag-drop), width slider
    list.tsx                  Bullet / numbered lists, inline +/− item controls
    table.tsx                 Full table — add/delete rows+cols, cell merge/unmerge
    code.tsx                  Verbatim / lstlisting code blocks
  components/
    formatting-toolbar.tsx    Single-row toolbar (style, B/I/U, math, insert, LaTeX)
    insert-line.tsx           Hover-reveal insert line with block type picker
    inline-text.tsx           Safe contentEditable string wrapper
```

## Getting started

The frontend expects the NexTex backend running on `http://127.0.0.1:8000`.

```bash
# Backend (FastAPI)
cd backend && source venv/bin/activate && uvicorn main:app --reload

# Frontend
cd frontend && npm install && npm run dev   # http://localhost:3000
```

Compilation requires a local TeX distribution (MacTeX, TeX Live, or MiKTeX).

## Scripts

```bash
npm run dev        # dev server (Turbopack)
npm run build      # production build
npm run test       # Vitest unit tests
npm run test:e2e   # Playwright e2e (needs running dev server)
```
