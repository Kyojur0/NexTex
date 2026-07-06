"use client"

import { memo, useState } from "react"
import { cn } from "@/lib/utils"
import type { BlockType } from "../types"
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Superscript,
  Subscript,
  Sigma,
  Code,
  Link,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  PanelRight,
  Undo,
  Redo,
  Type,
  Heading1,
  Heading2,
  Heading3,
  Heading,
  Table,
  Image,
  FileCode,
  Eye,
  Code2,
  ChevronDown,
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

const paragraphStyleLabels: Record<ParagraphStyle, string> = {
  normal: "Normal",
  "heading-1": "Heading 1",
  "heading-2": "Heading 2",
  "heading-3": "Heading 3",
}

const ToolButton = memo(function ToolButton({
  active,
  disabled,
  onClick,
  title,
  children,
  className,
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
        "h-8 w-8 inline-flex items-center justify-center rounded-md text-[13px] transition-colors duration-100",
        "text-[var(--visual-editor-text)]",
        active && "bg-[var(--visual-editor-tool-active)] text-[var(--primary)]",
        !active && !disabled && "hover:bg-[var(--visual-editor-tool-hover)]",
        disabled && "opacity-40 cursor-not-allowed",
        className
      )}
    >
      {children}
    </button>
  )
})

const ToolbarDivider = memo(function ToolbarDivider() {
  return <div className="w-px h-6 bg-[var(--visual-editor-toolbar-border)] mx-1" />
})

const StyleDropdown = memo(function StyleDropdown({
  value,
  onChange,
}: {
  value: ParagraphStyle
  onChange: (style: ParagraphStyle) => void
}) {
  return (
    <div className="relative group">
      <button
        type="button"
        className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md text-[12px] font-medium text-[var(--visual-editor-text)] hover:bg-[var(--visual-editor-tool-hover)] transition-colors min-w-[110px]"
      >
        <Heading className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">{paragraphStyleLabels[value]}</span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-50 min-w-[150px] rounded-lg border border-[var(--visual-editor-toolbar-border)] bg-[var(--visual-editor-toolbar)] shadow-floating overflow-hidden">
        {(Object.keys(paragraphStyleLabels) as ParagraphStyle[]).map((style) => (
          <button
            key={style}
            type="button"
            onClick={() => onChange(style)}
            className={cn(
              "w-full px-3 py-2 text-left text-xs transition-colors",
              value === style
                ? "bg-[var(--visual-editor-tool-active)] text-[var(--primary)]"
                : "text-[var(--visual-editor-text)] hover:bg-[var(--visual-editor-tool-hover)]"
            )}
          >
            {style === "normal" && <Type className="h-3.5 w-3.5 inline mr-2" />}
            {style === "heading-1" && <Heading1 className="h-3.5 w-3.5 inline mr-2" />}
            {style === "heading-2" && <Heading2 className="h-3.5 w-3.5 inline mr-2" />}
            {style === "heading-3" && <Heading3 className="h-3.5 w-3.5 inline mr-2" />}
            {paragraphStyleLabels[style]}
          </button>
        ))}
      </div>
    </div>
  )
}
)

const InsertMenu = memo(function InsertMenu({ onInsert }: { onInsert: (type: BlockType) => void }) {
  const [open, setOpen] = useState(false)
  const items: { type: BlockType; label: string; icon: React.ElementType }[] = [
    { type: "paragraph", label: "Paragraph", icon: Type },
    { type: "section", label: "Section", icon: Heading1 },
    { type: "table", label: "Table", icon: Table },
    { type: "figure", label: "Figure", icon: Image },
    { type: "math", label: "Math", icon: Sigma },
    { type: "code", label: "Code", icon: FileCode },
    { type: "list", label: "List", icon: List },
  ]

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="insert-menu-button"
        onClick={() => setOpen((o) => !o)}
        className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md text-[12px] font-medium text-[var(--visual-editor-text)] hover:bg-[var(--visual-editor-tool-hover)] transition-colors"
      >
        <span>Insert</span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[150px] rounded-lg border border-[var(--visual-editor-toolbar-border)] bg-[var(--visual-editor-toolbar)] shadow-floating overflow-hidden">
          {items.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              type="button"
              data-testid={`insert-menu-${type}`}
              onClick={() => {
                onInsert(type)
                setOpen(false)
              }}
              className="w-full px-3 py-2 text-left text-xs text-[var(--visual-editor-text)] hover:bg-[var(--visual-editor-tool-hover)] transition-colors flex items-center gap-2"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
})

export const FormattingToolbar = memo(function FormattingToolbar({
  paragraphStyle,
  format,
  isVisual,
  latexPanelOpen,
  canUndo,
  canRedo,
  onParagraphStyleChange,
  onFormatToggle,
  onInlineMath,
  onLink,
  onListToggle,
  onIndent,
  onInsert,
  onToggleLatexPanel,
  onToggleView,
  onUndo,
  onRedo,
}: FormattingToolbarProps) {
  return (
    <div className="shrink-0 bg-[var(--visual-editor-toolbar)] border-b border-[var(--visual-editor-toolbar-border)] px-3 py-2 flex flex-col gap-1.5 select-none">
      {/* Row 1: Inline formatting (disabled until robust formatting is implemented) */}
      <div className="flex items-center gap-0.5 h-8">
        <ToolButton onClick={onUndo} disabled={!canUndo} title="Undo">
          <Undo className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton onClick={onRedo} disabled={!canRedo} title="Redo">
          <Redo className="h-3.5 w-3.5" />
        </ToolButton>

        <ToolbarDivider />

        <ToolButton active={format.bold} disabled title="Bold (coming soon)">
          <Bold className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton active={format.italic} disabled title="Italic (coming soon)">
          <Italic className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton active={format.underline} disabled title="Underline (coming soon)">
          <Underline className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton active={format.strikethrough} disabled title="Strikethrough (coming soon)">
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton active={format.superscript} disabled title="Superscript (coming soon)">
          <Superscript className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton active={format.subscript} disabled title="Subscript (coming soon)">
          <Subscript className="h-3.5 w-3.5" />
        </ToolButton>

        <ToolbarDivider />

        <ToolButton onClick={onInlineMath} disabled title="Inline math (coming soon)">
          <Sigma className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton active={format.code} disabled title="Inline code (coming soon)">
          <Code className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton onClick={onLink} disabled title="Link (coming soon)">
          <Link className="h-3.5 w-3.5" />
        </ToolButton>
      </div>

      {/* Row 2: Block structure */}
      <div className="flex items-center gap-0.5 h-8">
        <StyleDropdown value={paragraphStyle} onChange={onParagraphStyleChange} />

        <ToolbarDivider />

        <ToolButton onClick={() => onListToggle("itemize")} title="Bullet list">
          <List className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton onClick={() => onListToggle("enumerate")} title="Numbered list">
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolButton>

        <ToolbarDivider />

        <ToolButton onClick={() => onIndent("out")} title="Decrease indent">
          <AlignLeft className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton onClick={() => onIndent("in")} title="Increase indent">
          <AlignCenter className="h-3.5 w-3.5" />
        </ToolButton>

        <ToolbarDivider />

        <InsertMenu onInsert={onInsert} />

        <div className="flex-1" />

        <ToolButton
          active={latexPanelOpen}
          onClick={onToggleLatexPanel}
          title={latexPanelOpen ? "Hide LaTeX panel" : "Show LaTeX panel"}
        >
          <PanelRight className="h-3.5 w-3.5" />
        </ToolButton>

        <div className="flex items-center rounded-md border border-[var(--visual-editor-toolbar-border)] overflow-hidden ml-1">
          <button
            type="button"
            data-testid="visual-toolbar-code-tab"
            onClick={onToggleView}
            className={cn(
              "h-7 px-3 text-[11px] font-medium transition-colors flex items-center gap-1.5",
              !isVisual
                ? "bg-[var(--visual-editor-tool-active)] text-[var(--visual-editor-text)]"
                : "text-[var(--visual-editor-text-dim)] hover:text-[var(--visual-editor-text)] hover:bg-[var(--visual-editor-tool-hover)]"
            )}
          >
            <Code2 className="h-3 w-3" />
            Code
          </button>
          <button
            type="button"
            onClick={onToggleView}
            className={cn(
              "h-7 px-3 text-[11px] font-medium transition-colors flex items-center gap-1.5",
              isVisual
                ? "bg-[var(--visual-editor-tool-active)] text-[var(--visual-editor-text)]"
                : "text-[var(--visual-editor-text-dim)] hover:text-[var(--visual-editor-text)] hover:bg-[var(--visual-editor-tool-hover)]"
            )}
          >
            <Eye className="h-3 w-3" />
            Visual
          </button>
        </div>
      </div>
    </div>
  )
})
