# NexTex — Implementation Notes

## Overview

NexTex is a local-first LaTeX editor with two editing modes: a raw code editor and a
visual block editor that round-trips to `.tex`. The UI follows the **Fable5 warm
parchment** design system — burnt-orange accent (`#C44528`), Georgia serif typography
on a white page card, DM Sans for the shell.

---

## Architecture

### State (`lib/store.ts`)
Single Zustand store covering everything:
- **Workspace** — file tree, active file, recent files, workspace root, trusted-local flag
- **Editor** — content string, isModified, errorLines
- **Build** — isBuilding, buildLogs, showBuildLog, pdfUrl
- **UI** — showPreview, showSettings, showTemplateModal, showAISpotlight,
  showHistory, showVisualLatexPanel, sidebarWidth, isDragging, activeEditorTab
- **Settings** — fontSize, tabSize, wordWrap, enableSyntaxHighlight, autoSave,
  buildOnSave, compiler, aiModel
- Persisted to localStorage via a Zustand middleware

### Visual editor (`lib/visual-editor/`)

**Block model**

Each block is `{ id, type, data }`. Block types:
`paragraph | section | math | figure | list | table | code`

Data types per plugin are defined in each plugin file and typed with
`BlockPlugin<TData>`.

**Parser** (`parser.ts`) — LaTeX string → `AnyVisualBlock[]`  
Walks the LaTeX line by line, matches environments and commands, produces typed
block objects. Handles `\section`, `\subsection`, `\subsubsection`, `equation`,
`figure`, `itemize`, `enumerate`, `tabular`, `lstlisting`, inline paragraphs.

**Serializer** (`serializer.ts`) — `AnyVisualBlock[]` → LaTeX string  
Delegates to each plugin's `toLaTeX(data)` method and joins with blank lines.

**Plugin contract** (`types.ts`)
```ts
interface BlockPlugin<TData> {
  type: BlockType
  label: string
  icon: LucideIcon
  color: string          // hex, used for icon tint in insert picker
  defaultData: TData
  isText: boolean        // enables split/mergeUp keyboard behaviour
  renderEditor(ctx): React.ReactNode
  toLaTeX(data: TData): string
}
```

`renderEditor` is called inside `BlockRenderer` and may contain hooks
(useState, useRef, useCallback, useEffect) — the same plugin is always
rendered in the same slot, so hook order is stable.

**Block renderer** (`components/editor/block-renderer.tsx`)  
Wraps each block with the Fable5 block frame:
- 3 px left border — transparent → `var(--primary)` when active
- Drag handle on the left (GripVertical, absolute-positioned)
- Floating type chip + dup/delete icons above the block when active
- `onMouseDown` uses `e.preventDefault()` on all control buttons to keep
  InlineText focused and prevent premature `onBlur → isActive=false` races

### Table plugin — cell merge model

`TableCell = { content, colspan, rowspan, hidden? }`  
Rows are `TableCell[][]`. Hidden cells are still stored but not rendered
(`colSpan/rowSpan` of the root cell covers them). LaTeX export uses
`\multicolumn` and `\multirow`.

Selection is two React state values (`selAnchor`, `selHead`) tracking
`[row, col]` indices. Shift-click extends the selection rectangle.

### Figure plugin — image upload

Uses `URL.createObjectURL` for an in-editor preview stored in component state
(not persisted). The filename is stored in block data for LaTeX export.
A hidden `<input type="file" accept="image/*">` is triggered by both the
"browse files" link and the drag-drop area.

### Formatting toolbar

Single 46 px bar (Fable5 style):  
`[Style ▾] | [↩][↺] | [B][I][U][~~] | [•][1.] | [ƒx][<>][🔗] | [⟵][⟹] | [+Insert▾] — [Code|Visual] [{ }LaTeX]`

The style picker and insert dropdown manage their own open/close state with
`useRef` + `document.addEventListener("mousedown", close)` for outside-click
dismissal.

---

## Design tokens

All in `app/globals.css` as CSS custom properties:

| Token | Light | Dark |
|---|---|---|
| `--background` | `#F7F5F0` | `#211E1A` |
| `--card` (page) | `#FFFFFF` | `#2A2620` |
| `--primary` (accent) | `#C44528` | `#E05838` |
| `--border` | `#E6E1D5` | `#363028` |
| `--visual-editor-bg` | `#F0EDE6` | `#211E1A` |
| `--code-bg` | `#FBF7EE` | `#1D1A16` |

Colour palette overrides (blue, emerald, minimal) swap only `--primary` and
related tokens.

---

## Key interactions

| Action | How |
|---|---|
| Block select | Click anywhere on block → `setFocusedBlockId` |
| Block deselect | `onBlur` on block container → `setFocusedBlockId(null)` |
| Drag reorder | `@dnd-kit/sortable` `PointerSensor` (5 px threshold) |
| Insert block | Hover insert line → click + → pick type, or toolbar Insert menu |
| Split paragraph | Enter key in `InlineText` → `onSplit(before, after)` |
| Merge up | Backspace at start → `onMergeUp` |
| Table merge | Click cell, Shift+click another → Merge cells button |
| Keyboard shortcuts | ⌘S save, ⌘B build, ⌘K AI spotlight, Esc close spotlight |

---

## Testing

- **Vitest** unit tests in `lib/__tests__/` (store, API, syntax highlighter)
- **Playwright** e2e in `e2e/` (visual editor smoke tests)
- Component test for `file-tree` in `components/editor/__tests__/`
