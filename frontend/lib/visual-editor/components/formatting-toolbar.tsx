"use client"

import { memo, useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import type { BlockType } from "../types"
import {
  Bold, Italic, Underline, Strikethrough,
  Superscript, Subscript, Sigma, Code, Link,
  List, ListOrdered, AlignLeft, AlignCenter,
  PanelRight, Undo, Redo, ChevronDown,
  Type, Heading1, Heading2, Heading3,
  Table, Image, FileCode, Eye, Code2, Plus,
} from "lucide-react"

export type ParagraphStyle = "normal" | "heading-1" | "heading-2" | "heading-3"

export interface FormatState {
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  superscript: boolean
  subscript: boolean
  code: boolean
}

export interface FormattingToolbarProps {
  paragraphStyle: ParagraphStyle
  format: FormatState
  isVisual: boolean
  latexPanelOpen: boolean
  canUndo?: boolean
  canRedo?: boolean
  onParagraphStyleChange: (style: ParagraphStyle) => void
  onFormatToggle: (key: keyof FormatState) => void
  onInlineMath: () => void
  onLink: () => void
  onListToggle: (kind: "itemize" | "enumerate") => void
  onIndent: (direction: "in" | "out") => void
  onInsert: (type: BlockType) => void
  onToggleLatexPanel: () => void
  onToggleView: () => void
  onUndo?: () => void
  onRedo?: () => void
}

const STYLE_LABELS: Record<ParagraphStyle, string> = {
  normal:      "Paragraph",
  "heading-1": "Section",
  "heading-2": "Subsection",
  "heading-3": "Subsubsection",
}

const STYLE_HINTS: Record<ParagraphStyle, string> = {
  normal:      "text",
  "heading-1": "\\section",
  "heading-2": "\\subsection",
  "heading-3": "\\subsubsection",
}

/* ── Primitives ──────────────────────────────────────────── */

const TBtn = memo(function TBtn({
  active, disabled, onClick, title, children, className,
}: {
  active?: boolean
  disabled?: boolean
  onClick?: () => void
  title?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "min-w-[27px] h-[27px] px-1.5 inline-flex items-center justify-center rounded-[5px]",
        "text-[13px] transition-colors duration-100 select-none",
        "text-[var(--visual-editor-text)]",
        active  && "bg-[var(--visual-editor-tool-active)] text-[var(--visual-editor-tool-active-text)]",
        !active && !disabled && "hover:bg-[var(--visual-editor-tool-hover)]",
        disabled && "opacity-35 cursor-not-allowed",
        className,
      )}
    >
      {children}
    </button>
  )
})

const TSep = memo(function TSep() {
  return <div className="w-px h-[18px] bg-[var(--visual-editor-toolbar-border)] mx-1.5 shrink-0" />
})

/* ── Style picker dropdown ───────────────────────────────── */

const StylePicker = memo(function StylePicker({
  value, onChange,
}: { value: ParagraphStyle; onChange: (s: ParagraphStyle) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [open])

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "h-[28px] px-2.5 inline-flex items-center gap-1.5 rounded-[6px]",
          "text-[12.5px] font-medium text-[var(--visual-editor-text)]",
          "bg-[var(--visual-editor-canvas)] border border-[var(--visual-editor-toolbar-border)]",
          "hover:border-[var(--visual-editor-insert-line)] transition-colors min-w-[118px]",
        )}
      >
        <span className="flex-1 text-left">{STYLE_LABELS[value]}</span>
        <ChevronDown className="h-[9px] w-[9px] opacity-55 shrink-0" />
      </button>

      {open && (
        <div className={cn(
          "absolute left-0 top-[calc(100%+5px)] z-50 min-w-[180px]",
          "bg-[var(--visual-editor-canvas)] border border-[var(--visual-editor-toolbar-border)]",
          "rounded-[8px] shadow-floating py-[5px] overflow-hidden",
        )}>
          {(Object.keys(STYLE_LABELS) as ParagraphStyle[]).map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onChange(s); setOpen(false) }}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-1.5 text-[12.5px] transition-colors",
                value === s
                  ? "text-[var(--visual-editor-tool-active-text)] font-semibold"
                  : "text-[var(--visual-editor-text)] hover:bg-[var(--visual-editor-tool-hover)]",
              )}
            >
              <span className="flex-1 text-left">{STYLE_LABELS[s]}</span>
              <span className="font-mono text-[10px] text-[var(--visual-editor-text-dim)]">{STYLE_HINTS[s]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
})

/* ── Insert dropdown ──────────────────────────────────────── */

const INSERT_ITEMS: { type: BlockType; label: string; hint: string }[] = [
  { type: "paragraph", label: "Paragraph",       hint: "text" },
  { type: "section",   label: "Section heading", hint: "\\section" },
  { type: "math",      label: "Equation",        hint: "equation" },
  { type: "figure",    label: "Figure",          hint: "figure" },
  { type: "list",      label: "Bullet list",     hint: "itemize" },
  { type: "table",     label: "Table",           hint: "tabular" },
  { type: "code",      label: "Code block",      hint: "verbatim" },
]

const InsertBtn = memo(function InsertBtn({ onInsert }: { onInsert: (t: BlockType) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [open])

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        data-testid="insert-menu-button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "h-[27px] px-2.5 inline-flex items-center gap-1.5 rounded-[5px]",
          "text-[12.5px] font-medium text-[var(--visual-editor-text)]",
          "hover:bg-[var(--visual-editor-tool-hover)] transition-colors",
        )}
      >
        <Plus className="h-3 w-3" />
        <span>Insert</span>
        <ChevronDown className="h-[9px] w-[9px] opacity-55" />
      </button>

      {open && (
        <div className={cn(
          "absolute left-auto right-0 top-[calc(100%+5px)] z-50 min-w-[180px]",
          "bg-[var(--visual-editor-canvas)] border border-[var(--visual-editor-toolbar-border)]",
          "rounded-[8px] shadow-floating py-[5px] overflow-hidden",
        )}>
          {INSERT_ITEMS.map(({ type, label, hint }) => (
            <button
              key={type}
              type="button"
              data-testid={`insert-menu-${type}`}
              onMouseDown={(e) => { e.preventDefault(); onInsert(type); setOpen(false) }}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-1.5 text-[12.5px]",
                "text-[var(--visual-editor-text)] hover:bg-[var(--visual-editor-tool-hover)] transition-colors",
              )}
            >
              <span className="flex-1 text-left">{label}</span>
              <span className="font-mono text-[10px] text-[var(--visual-editor-text-dim)]">{hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
})

/* ── Main toolbar ────────────────────────────────────────── */

export const FormattingToolbar = memo(function FormattingToolbar({
  paragraphStyle, format, isVisual, latexPanelOpen,
  canUndo, canRedo,
  onParagraphStyleChange, onFormatToggle, onInlineMath, onLink,
  onListToggle, onIndent, onInsert, onToggleLatexPanel, onToggleView,
  onUndo, onRedo,
}: FormattingToolbarProps) {
  return (
    <div
      className={cn(
        "shrink-0 h-[46px] flex items-center gap-0.5 px-3.5 select-none",
        "border-b border-[var(--visual-editor-toolbar-border)]",
        "bg-[var(--visual-editor-toolbar)] transition-colors",
      )}
    >
      {/* Style picker */}
      <StylePicker value={paragraphStyle} onChange={onParagraphStyleChange} />

      <TSep />

      {/* Undo / Redo */}
      <TBtn onClick={onUndo} disabled={!canUndo} title="Undo">
        <Undo className="h-3.5 w-3.5" />
      </TBtn>
      <TBtn onClick={onRedo} disabled={!canRedo} title="Redo">
        <Redo className="h-3.5 w-3.5" />
      </TBtn>

      <TSep />

      {/* Bold / Italic / Underline */}
      <TBtn
        active={format.bold}
        onClick={() => onFormatToggle("bold")}
        title="Bold (Ctrl+B)"
        className="font-serif font-bold text-[13.5px]"
      >B</TBtn>
      <TBtn
        active={format.italic}
        onClick={() => onFormatToggle("italic")}
        title="Italic (Ctrl+I)"
        className="font-serif italic text-[13.5px]"
      >I</TBtn>
      <TBtn
        active={format.underline}
        onClick={() => onFormatToggle("underline")}
        title="Underline (Ctrl+U)"
        className="font-serif underline underline-offset-[2px] text-[13.5px]"
      >U</TBtn>
      <TBtn
        active={format.strikethrough}
        onClick={() => onFormatToggle("strikethrough")}
        title="Strikethrough"
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </TBtn>

      <TSep />

      {/* Lists */}
      <TBtn onClick={() => onListToggle("itemize")} title="Bullet list">
        <List className="h-3.5 w-3.5" />
      </TBtn>
      <TBtn onClick={() => onListToggle("enumerate")} title="Numbered list">
        <ListOrdered className="h-3.5 w-3.5" />
      </TBtn>

      <TSep />

      {/* Math / Code / Link */}
      <TBtn onClick={onInlineMath} title="Inline math — select text then click" className="font-serif italic text-[13px]">
        ƒx
      </TBtn>
      <TBtn active={format.code} onClick={() => onFormatToggle("code")} title="Inline code">
        <Code className="h-3.5 w-3.5" />
      </TBtn>
      <TBtn onClick={onLink} title="Link">
        <Link className="h-3.5 w-3.5" />
      </TBtn>

      <TSep />

      {/* Indent */}
      <TBtn onClick={() => onIndent("out")} title="Decrease indent">
        <AlignLeft className="h-3.5 w-3.5" />
      </TBtn>
      <TBtn onClick={() => onIndent("in")} title="Increase indent">
        <AlignCenter className="h-3.5 w-3.5" />
      </TBtn>

      <TSep />

      {/* Insert */}
      <InsertBtn onInsert={onInsert} />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Code / Visual toggle */}
      <div className={cn(
        "flex items-center rounded-[6px] border border-[var(--visual-editor-toolbar-border)] overflow-hidden mr-1.5",
      )}>
        <button
          type="button"
          data-testid="visual-toolbar-code-tab"
          onClick={onToggleView}
          className={cn(
            "h-[28px] px-3 text-[11px] font-medium transition-colors flex items-center gap-1.5",
            !isVisual
              ? "bg-[var(--visual-editor-tool-active)] text-[var(--visual-editor-tool-active-text)]"
              : "text-[var(--visual-editor-text-dim)] hover:text-[var(--visual-editor-text)] hover:bg-[var(--visual-editor-tool-hover)]",
          )}
        >
          <Code2 className="h-3 w-3" />
          Code
        </button>
        <button
          type="button"
          onClick={onToggleView}
          className={cn(
            "h-[28px] px-3 text-[11px] font-medium transition-colors flex items-center gap-1.5",
            isVisual
              ? "bg-[var(--visual-editor-tool-active)] text-[var(--visual-editor-tool-active-text)]"
              : "text-[var(--visual-editor-text-dim)] hover:text-[var(--visual-editor-text)] hover:bg-[var(--visual-editor-tool-hover)]",
          )}
        >
          <Eye className="h-3 w-3" />
          Visual
        </button>
      </div>

      {/* LaTeX panel toggle */}
      <button
        type="button"
        onClick={onToggleLatexPanel}
        title={latexPanelOpen ? "Hide LaTeX panel" : "Show LaTeX panel"}
        className={cn(
          "h-[28px] px-2.5 flex items-center gap-1.5 rounded-[6px]",
          "border transition-colors text-[11px] font-mono",
          latexPanelOpen
            ? "border-[rgba(196,69,40,0.4)] bg-[var(--visual-editor-tool-active)] text-[var(--visual-editor-tool-active-text)] font-semibold"
            : "border-[var(--visual-editor-toolbar-border)] text-[var(--visual-editor-text-dim)] hover:border-[var(--visual-editor-insert-line)]",
        )}
      >
        {"{ }"} <span className="font-sans text-[12px]">LaTeX</span>
      </button>
    </div>
  )
})
