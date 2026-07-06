# NexTex — Frontend

Next.js frontend for NexTex, a local-first LaTeX editor with a code editor,
file tree, live PDF preview, build-log terminal, and a visual block editor
that round-trips to `.tex`.

## Stack

- **Next.js** (App Router) + **React 19** + **TypeScript**
- **Zustand** for state (`lib/store.ts`)
- **Tailwind CSS** + **shadcn/ui** components
- **Framer Motion** for block animations
- **Vitest** for unit tests, **Playwright** for e2e

## Structure

```
app/                      Next.js App Router pages + API routes
components/
  editor/                 Editor shell: header, file tree, code editor,
                          PDF preview, build log, visual editor
  ui/                     shadcn/ui primitives
lib/
  api.ts                  Backend API client
  store.ts                Zustand store (workspace, files, build state)
  visual-editor/          Block editor: parser, serializer, plugins
styles/                   Global CSS
```

## Getting started

The frontend expects the NexTex backend (`../backend`) running on
`http://127.0.0.1:8000`. From this directory:

```bash
pnpm install     # or npm install
pnpm dev         # http://localhost:3000
```

Compilation requires a local TeX distribution (MacTeX, TeX Live, or MiKTeX).

## Scripts

```bash
pnpm dev          # dev server
pnpm build        # production build
pnpm test         # run Vitest suite once
pnpm test:watch   # Vitest in watch mode
pnpm lint         # ESLint
```
