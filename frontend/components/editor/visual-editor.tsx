"use client"

import { memo, useState, useRef, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { useEditorStore } from "@/lib/store"
import {
  createBlock,
  parseLaTeXToBlocks,
  blocksToLaTeX,
  moveBlock,
  duplicateBlock,
  deleteBlock,
  updateBlock,
  insertBlockAfter,
  type DocumentBlock,
  type BlockType,
} from "@/lib/latex-blocks"
import {
  Type,
  Bold,
  Italic,
  Underline,
  Superscript,
  Subscript,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Image,
  Table,
  Sigma,
  Quote,
  Code,
  Link,
  Footprints,
  ChevronRight,
  Plus,
  GripVertical,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Layers,
  Maximize2,
  Minimize2,
  ArrowUp,
  ArrowDown,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Minus,
  Frame,
  BookOpen,
  Check,
  Pencil,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Toolbar button
// ---------------------------------------------------------------------------

function ToolbarButton({
  icon: Icon,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  active?: boolean
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center h-7 w-7 rounded-md transition-all duration-150",
        disabled && "opacity-30 cursor-not-allowed",
        active
          ? "bg-primary/10 text-primary border border-primary/20"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/80 border border-transparent"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  )
}

// ---------------------------------------------------------------------------
// Element palette item
// ---------------------------------------------------------------------------

function ElementItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors group"
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 group-hover:text-foreground/80" />
      <span className="truncate">{label}</span>
      <Plus className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-50" />
    </button>
  )
}

// ---------------------------------------------------------------------------
// Formatting helpers — operate on textarea selection
// ---------------------------------------------------------------------------

function wrapSelection(
  textarea: HTMLTextAreaElement,
  prefix: string,
  suffix: string = prefix
): string {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const value = textarea.value
  const before = value.slice(0, start)
  const selected = value.slice(start, end)
  const after = value.slice(end)

  const newValue = before + prefix + selected + suffix + after
  const newCursor = start + prefix.length + selected.length + suffix.length

  textarea.value = newValue
  textarea.selectionStart = textarea.selectionEnd = newCursor
  textarea.focus()

  return newValue
}

function insertAtCursor(textarea: HTMLTextAreaElement, text: string): string {
  const start = textarea.selectionStart
  const value = textarea.value
  const newValue = value.slice(0, start) + text + value.slice(start)
  textarea.value = newValue
  textarea.selectionStart = textarea.selectionEnd = start + text.length
  textarea.focus()
  return newValue
}

// ---------------------------------------------------------------------------
// Block content renderer (read-only)
// ---------------------------------------------------------------------------

function BlockContent({ block }: { block: DocumentBlock }) {
  switch (block.type) {
    case "heading":
      return <h2 className="text-lg font-semibold text-foreground tracking-tight">{block.content}</h2>
    case "paragraph":
      return <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{block.content}</p>
    case "equation":
      return (
        <div className="flex items-center justify-center py-4">
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-muted/40 rounded-md border border-border/50">
            <Sigma className="h-4 w-4 text-muted-foreground/60" />
            <span className="text-sm font-mono text-foreground/90 whitespace-pre">{block.content}</span>
            <Sigma className="h-4 w-4 text-muted-foreground/60" />
          </div>
        </div>
      )
    case "figure":
      return (
        <div className="flex flex-col items-center gap-2 py-3">
          <div className="w-full h-32 bg-muted/30 rounded-md border border-dashed border-border/60 flex items-center justify-center">
            <div className="flex flex-col items-center gap-1.5 text-muted-foreground/50">
              <Image className="h-6 w-6" />
              <span className="text-xs">{block.content || "Figure placeholder"}</span>
            </div>
          </div>
          <span className="text-xs text-muted-foreground italic">{block.meta?.caption || "Figure caption"}</span>
        </div>
      )
    case "table":
      return (
        <div className="overflow-x-auto">
          <div className="text-xs font-mono text-foreground/70 whitespace-pre p-2 bg-muted/20 rounded border border-border/40">
            {block.content}
          </div>
        </div>
      )
    case "quote":
      return (
        <blockquote className="border-l-2 border-primary/30 pl-4 py-1 text-sm text-foreground/70 italic whitespace-pre-wrap">
          {block.content}
        </blockquote>
      )
    case "code":
      return (
        <div className="bg-muted/40 rounded-md p-3 font-mono text-xs text-foreground/80 overflow-x-auto whitespace-pre">
          {block.content}
        </div>
      )
    case "list":
      return (
        <ul className="list-disc list-inside text-sm text-foreground/80 space-y-0.5 whitespace-pre-wrap">
          {block.content.split("\n").map((line, i) => {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith("\\")) return null
            return <li key={i}>{trimmed.replace(/^\u2022\s*/, "").replace(/^-\s*/, "")}</li>
          })}
        </ul>
      )
    case "separator":
      return <div className="h-px bg-border/60 my-2" />
    default:
      return <p className="text-sm text-foreground/80 whitespace-pre-wrap">{block.content}</p>
  }
}

// ---------------------------------------------------------------------------
// Editable block textarea
// ---------------------------------------------------------------------------

function BlockTextarea({
  value,
  onChange,
  onBlur,
  fontSize = 14,
}: {
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  fontSize?: number
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.focus()
      ref.current.selectionStart = ref.current.value.length
      ref.current.selectionEnd = ref.current.value.length
    }
  }, [])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      className="w-full bg-transparent text-foreground text-sm leading-relaxed resize-none outline-none font-sans whitespace-pre-wrap"
      style={{ fontSize: `${fontSize}px`, minHeight: "1.5em" }}
      rows={Math.max(1, value.split("\n").length)}
    />
  )
}

// ---------------------------------------------------------------------------
// Block renderer
// ---------------------------------------------------------------------------

function BlockCard({
  block,
  isSelected,
  isEditing,
  onSelect,
  onEdit,
  onUpdate,
  onToggleCollapse,
  onToggleLock,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}: {
  block: DocumentBlock
  isSelected: boolean
  isEditing: boolean
  onSelect: () => void
  onEdit: () => void
  onUpdate: (updates: Partial<DocumentBlock>) => void
  onToggleCollapse: () => void
  onToggleLock: () => void
  onDelete: () => void
  onDuplicate: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const [hovered, setHovered] = useState(false)

  const baseClasses = cn(
    "relative group rounded-lg border transition-all duration-150",
    isSelected
      ? "border-primary/30 bg-primary/[0.03] ring-1 ring-primary/10"
      : "border-border/40 bg-background hover:border-border/70"
  )

  return (
    <div
      className={baseClasses}
      onClick={(e) => {
        // Don't select if clicking inside a button or textarea
        const target = e.target as HTMLElement
        if (target.closest("button") || target.closest("textarea")) return
        onSelect()
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Floating action toolbar */}
      <div
        className={cn(
          "absolute -top-2.5 right-2 flex items-center gap-0.5 bg-background border border-border/60 rounded-md shadow-sm px-1 py-0.5 transition-opacity duration-150 z-20",
          hovered || isSelected ? "opacity-100" : "opacity-0"
        )}
      >
        <button
          title="Edit"
          onClick={(e) => { e.stopPropagation(); onEdit() }}
          className={cn(
            "h-5 w-5 flex items-center justify-center rounded transition-colors",
            isEditing ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
          )}
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button title="Move up" onClick={(e) => { e.stopPropagation(); onMoveUp() }} className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/60">
          <ArrowUp className="h-3 w-3" />
        </button>
        <button title="Move down" onClick={(e) => { e.stopPropagation(); onMoveDown() }} className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/60">
          <ArrowDown className="h-3 w-3" />
        </button>
        <button
          title={block.collapsed ? "Expand" : "Collapse"}
          onClick={(e) => { e.stopPropagation(); onToggleCollapse() }}
          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/60"
        >
          {block.collapsed ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
        </button>
        <button
          title={block.locked ? "Unlock" : "Lock"}
          onClick={(e) => { e.stopPropagation(); onToggleLock() }}
          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/60"
        >
          {block.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
        </button>
        <div className="w-px h-3 bg-border/60 mx-0.5" />
        <button
          title="Duplicate"
          onClick={(e) => { e.stopPropagation(); onDuplicate() }}
          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/60"
        >
          <Copy className="h-3 w-3" />
        </button>
        <button
          title="Delete"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {/* LaTeX label badge */}
      {(hovered || isSelected) && block.label && (
        <div className="absolute -top-2.5 left-2 px-1.5 py-0.5 bg-primary/10 border border-primary/20 rounded text-[10px] font-mono text-primary/80">
          {block.label}
        </div>
      )}

      {/* Block content */}
      <div className={cn("p-3", block.collapsed && "hidden")}>
        {isEditing && !block.locked ? (
          <BlockTextarea
            value={block.content}
            onChange={(v) => onUpdate({ content: v })}
            onBlur={() => { /* keep editing until explicit done or click away */ }}
          />
        ) : (
          <BlockContent block={block} />
        )}
      </div>

      {/* Collapsed state */}
      {block.collapsed && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
          <ChevronRight className="h-3 w-3" />
          <span className="font-mono text-[10px] opacity-60">{block.label}</span>
          <span className="truncate opacity-40">{block.content.slice(0, 40)}</span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main visual editor
// ---------------------------------------------------------------------------

export const VisualEditor = memo(function VisualEditor() {
  const content = useEditorStore((s) => s.content)
  const setContent = useEditorStore((s) => s.setContent)
  const setIsModified = useEditorStore((s) => s.setIsModified)

  const [blocks, setBlocks] = useState<DocumentBlock[]>(() => parseLaTeXToBlocks(content))
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [activePalette, setActivePalette] = useState<"structure" | "math" | "media" | "layout">("structure")
  const [dirty, setDirty] = useState(false)
  const contentRef = useRef(content)

  // Sync blocks → LaTeX content (debounced)
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const syncToContent = useCallback((newBlocks: DocumentBlock[]) => {
    const latex = blocksToLaTeX(newBlocks)
    contentRef.current = latex
    setContent(latex)
    setIsModified(true)
    setDirty(true)
  }, [setContent, setIsModified])

  const scheduleSync = useCallback((newBlocks: DocumentBlock[]) => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(() => {
      syncToContent(newBlocks)
    }, 600)
  }, [syncToContent])

  // Watch for external content changes (e.g. from text editor)
  useEffect(() => {
    if (content !== contentRef.current) {
      setBlocks(parseLaTeXToBlocks(content))
      contentRef.current = content
      setDirty(false)
    }
  }, [content])

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    }
  }, [])

  // Block action handlers
  const handleUpdateBlock = useCallback((id: string, updates: Partial<DocumentBlock>) => {
    setBlocks((prev) => {
      const next = updateBlock(prev, id, updates)
      scheduleSync(next)
      return next
    })
  }, [scheduleSync])

  const handleToggleCollapse = useCallback((id: string) => {
    setBlocks((prev) => {
      const block = prev.find((b) => b.id === id)
      if (!block) return prev
      const next = updateBlock(prev, id, { collapsed: !block.collapsed })
      return next
    })
  }, [])

  const handleToggleLock = useCallback((id: string) => {
    setBlocks((prev) => {
      const block = prev.find((b) => b.id === id)
      if (!block) return prev
      const next = updateBlock(prev, id, { locked: !block.locked })
      return next
    })
  }, [])

  const handleDelete = useCallback((id: string) => {
    setBlocks((prev) => {
      const next = deleteBlock(prev, id)
      syncToContent(next)
      return next
    })
    setSelectedBlockId((curr) => (curr === id ? null : curr))
    setEditingBlockId((curr) => (curr === id ? null : curr))
  }, [syncToContent])

  const handleDuplicate = useCallback((id: string) => {
    setBlocks((prev) => {
      const next = duplicateBlock(prev, id)
      syncToContent(next)
      return next
    })
  }, [syncToContent])

  const handleMoveUp = useCallback((id: string) => {
    setBlocks((prev) => {
      const next = moveBlock(prev, id, "up")
      syncToContent(next)
      return next
    })
  }, [syncToContent])

  const handleMoveDown = useCallback((id: string) => {
    setBlocks((prev) => {
      const next = moveBlock(prev, id, "down")
      syncToContent(next)
      return next
    })
  }, [syncToContent])

  const handleInsertBlock = useCallback((type: BlockType) => {
    const newBlock = createBlock(type)
    setBlocks((prev) => {
      const next = insertBlockAfter(prev, selectedBlockId, newBlock)
      syncToContent(next)
      return next
    })
    setSelectedBlockId(newBlock.id)
    setEditingBlockId(newBlock.id)
  }, [selectedBlockId, syncToContent])

  const handleAddBlock = useCallback(() => {
    const newBlock = createBlock("paragraph")
    setBlocks((prev) => {
      const next = [...prev, newBlock]
      syncToContent(next)
      return next
    })
    setSelectedBlockId(newBlock.id)
    setEditingBlockId(newBlock.id)
  }, [syncToContent])

  // Formatting toolbar — applies to the editing block's textarea
  const getEditingTextarea = useCallback((): HTMLTextAreaElement | null => {
    if (!editingBlockId) return null
    return document.querySelector(`[data-block-id="${editingBlockId}"] textarea`) as HTMLTextAreaElement | null
  }, [editingBlockId])

  const applyFormat = useCallback((prefix: string, suffix?: string) => {
    const ta = getEditingTextarea()
    if (!ta) return
    const newValue = wrapSelection(ta, prefix, suffix || prefix)
    if (editingBlockId) {
      handleUpdateBlock(editingBlockId, { content: newValue })
    }
  }, [getEditingTextarea, editingBlockId, handleUpdateBlock])

  const insertText = useCallback((text: string) => {
    const ta = getEditingTextarea()
    if (!ta) return
    const newValue = insertAtCursor(ta, text)
    if (editingBlockId) {
      handleUpdateBlock(editingBlockId, { content: newValue })
    }
  }, [getEditingTextarea, editingBlockId, handleUpdateBlock])

  const hasEditingBlock = !!editingBlockId

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Formatting Toolbar */}
      <div className="shrink-0 flex items-center gap-1 px-3 py-2 border-b border-border/60 bg-muted/20">
        <div className="flex items-center gap-0.5">
          <ToolbarButton icon={Bold} label="Bold" disabled={!hasEditingBlock} onClick={() => applyFormat("\\textbf{", "}")} />
          <ToolbarButton icon={Italic} label="Italic" disabled={!hasEditingBlock} onClick={() => applyFormat("\\textit{", "}")} />
          <ToolbarButton icon={Underline} label="Underline" disabled={!hasEditingBlock} onClick={() => applyFormat("\\underline{", "}")} />
          <ToolbarButton icon={Superscript} label="Superscript" disabled={!hasEditingBlock} onClick={() => insertText("^{}")} />
          <ToolbarButton icon={Subscript} label="Subscript" disabled={!hasEditingBlock} onClick={() => insertText("_{}")} />
        </div>
        <div className="w-px h-4 bg-border/60 mx-1" />
        <div className="flex items-center gap-0.5">
          <ToolbarButton icon={AlignLeft} label="Align Left" disabled={!hasEditingBlock} onClick={() => insertText("\\raggedright ")} />
          <ToolbarButton icon={AlignCenter} label="Align Center" disabled={!hasEditingBlock} onClick={() => insertText("\\centering ")} />
          <ToolbarButton icon={AlignRight} label="Align Right" disabled={!hasEditingBlock} onClick={() => insertText("\\raggedleft ")} />
        </div>
        <div className="w-px h-4 bg-border/60 mx-1" />
        <div className="flex items-center gap-0.5">
          <ToolbarButton icon={List} label="Bullet List" disabled={!hasEditingBlock} onClick={() => applyFormat("\\begin{itemize}\n\\item ", "\n\\end{itemize}")} />
          <ToolbarButton icon={ListOrdered} label="Numbered List" disabled={!hasEditingBlock} onClick={() => applyFormat("\\begin{enumerate}\n\\item ", "\n\\end{enumerate}")} />
          <ToolbarButton icon={Link} label="Hyperlink" disabled={!hasEditingBlock} onClick={() => insertText("\\href{http://}{}")} />
          <ToolbarButton icon={Footprints} label="Footnote" disabled={!hasEditingBlock} onClick={() => insertText("\\footnote{}")} />
        </div>
        <div className="w-px h-4 bg-border/60 mx-1" />
        <div className="flex items-center gap-0.5">
          <ToolbarButton icon={Code} label="Inline Code" disabled={!hasEditingBlock} onClick={() => applyFormat("\\texttt{", "}")} />
        </div>
        {dirty && (
          <div className="ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-[10px] text-yellow-600 dark:text-yellow-400">
            <Pencil className="h-2.5 w-2.5" />
            Unsaved changes
          </div>
        )}
      </div>

      {/* Main workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Element Palette Sidebar */}
        <div className="w-52 shrink-0 flex flex-col border-r border-border/60 bg-muted/10">
          <div className="px-3 py-2.5 border-b border-border/40">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Elements
            </span>
          </div>

          {/* Palette tabs */}
          <div className="flex items-center gap-0.5 px-2 pt-2">
            {(
              [
                { key: "structure", icon: Layers, label: "Structure" },
                { key: "math", icon: Sigma, label: "Math" },
                { key: "media", icon: Image, label: "Media" },
                { key: "layout", icon: Frame, label: "Layout" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActivePalette(tab.key)}
                title={tab.label}
                className={cn(
                  "flex-1 flex items-center justify-center h-7 rounded-md transition-all",
                  activePalette === tab.key
                    ? "bg-background text-foreground shadow-sm border border-border/40"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <tab.icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-1.5 py-2 space-y-0.5">
            {activePalette === "structure" && (
              <>
                <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider">Document</div>
                <ElementItem icon={Heading1} label="Section" onClick={() => handleInsertBlock("heading")} />
                <ElementItem icon={Heading2} label="Subsection" onClick={() => handleInsertBlock("heading")} />
                <ElementItem icon={Heading3} label="Subsubsection" onClick={() => handleInsertBlock("heading")} />
                <ElementItem icon={Type} label="Paragraph" onClick={() => handleInsertBlock("paragraph")} />
                <ElementItem icon={BookOpen} label="Abstract" onClick={() => handleInsertBlock("paragraph")} />
                <div className="px-2 py-1 mt-2 text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider">Lists & Tables</div>
                <ElementItem icon={List} label="Itemize" onClick={() => handleInsertBlock("list")} />
                <ElementItem icon={ListOrdered} label="Enumerate" onClick={() => handleInsertBlock("list")} />
                <ElementItem icon={Table} label="Table" onClick={() => handleInsertBlock("table")} />
              </>
            )}
            {activePalette === "math" && (
              <>
                <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider">Equations</div>
                <ElementItem icon={Sigma} label="Inline Math" onClick={() => handleInsertBlock("equation")} />
                <ElementItem icon={Sigma} label="Equation" onClick={() => handleInsertBlock("equation")} />
                <ElementItem icon={Sigma} label="Align Environment" onClick={() => handleInsertBlock("equation")} />
                <div className="px-2 py-1 mt-2 text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider">Theorems</div>
                <ElementItem icon={BookOpen} label="Theorem" onClick={() => handleInsertBlock("quote")} />
                <ElementItem icon={BookOpen} label="Proof" onClick={() => handleInsertBlock("quote")} />
              </>
            )}
            {activePalette === "media" && (
              <>
                <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider">Figures</div>
                <ElementItem icon={Image} label="Image / Figure" onClick={() => handleInsertBlock("figure")} />
                <div className="px-2 py-1 mt-2 text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider">Other</div>
                <ElementItem icon={Link} label="Hyperlink" onClick={() => handleInsertBlock("paragraph")} />
                <ElementItem icon={Footprints} label="Footnote" onClick={() => handleInsertBlock("paragraph")} />
                <ElementItem icon={Code} label="Code Listing" onClick={() => handleInsertBlock("code")} />
              </>
            )}
            {activePalette === "layout" && (
              <>
                <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider">Layout</div>
                <ElementItem icon={Minus} label="Horizontal Rule" onClick={() => handleInsertBlock("separator")} />
                <ElementItem icon={Frame} label="Minipage" onClick={() => handleInsertBlock("paragraph")} />
                <ElementItem icon={AlignCenter} label="Center" onClick={() => handleInsertBlock("paragraph")} />
                <div className="px-2 py-1 mt-2 text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider">Boxes</div>
                <ElementItem icon={Frame} label="Framed" onClick={() => handleInsertBlock("quote")} />
                <ElementItem icon={Quote} label="Quote" onClick={() => handleInsertBlock("quote")} />
              </>
            )}
          </div>
        </div>

        {/* Document Canvas */}
        <div className="flex-1 overflow-y-auto bg-muted/10">
          <div className="max-w-3xl mx-auto py-6 px-8">
            <div className="bg-background rounded-lg border border-border/50 shadow-sm min-h-[600px]">
              {/* Document header */}
              <div className="px-6 pt-6 pb-2 border-b border-border/30">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-muted-foreground/50">
                    {dirty ? "document.tex — Modified" : "document.tex — Visual Mode"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {dirty && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-[10px] text-yellow-600 dark:text-yellow-400">
                        <Pencil className="h-2.5 w-2.5" />
                        Unsaved
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-600 dark:text-emerald-400">
                      <Check className="h-2.5 w-2.5" />
                      Live Sync
                    </span>
                  </div>
                </div>
              </div>

              {/* Document body with blocks */}
              <div className="px-6 py-4 space-y-3">
                {blocks.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground/50 text-sm">
                    <p>Your document is empty.</p>
                    <p className="text-xs mt-1">Select an element from the palette to get started.</p>
                  </div>
                )}

                {blocks.map((block) => (
                  <div key={block.id} data-block-id={block.id}>
                    <BlockCard
                      block={block}
                      isSelected={selectedBlockId === block.id}
                      isEditing={editingBlockId === block.id}
                      onSelect={() => {
                        setSelectedBlockId(block.id)
                        setEditingBlockId(null)
                      }}
                      onEdit={() => {
                        if (block.locked) return
                        setSelectedBlockId(block.id)
                        setEditingBlockId((curr) => (curr === block.id ? null : block.id))
                      }}
                      onUpdate={(updates) => handleUpdateBlock(block.id, updates)}
                      onToggleCollapse={() => handleToggleCollapse(block.id)}
                      onToggleLock={() => handleToggleLock(block.id)}
                      onDelete={() => handleDelete(block.id)}
                      onDuplicate={() => handleDuplicate(block.id)}
                      onMoveUp={() => handleMoveUp(block.id)}
                      onMoveDown={() => handleMoveDown(block.id)}
                    />
                  </div>
                ))}

                {/* Add block placeholder */}
                <button
                  onClick={handleAddBlock}
                  className="w-full py-3 flex items-center justify-center gap-2 rounded-lg border border-dashed border-border/40 text-muted-foreground/50 hover:text-muted-foreground hover:border-border/70 hover:bg-muted/20 transition-all"
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-xs">Add paragraph block</span>
                </button>
              </div>
            </div>
            <div className="h-8" />
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="shrink-0 flex items-center justify-between px-3 py-1.5 border-t border-border/60 bg-muted/20 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>{blocks.length} blocks</span>
          <span>•</span>
          <span>Visual Editor</span>
        </div>
        <div className="flex items-center gap-3">
          <span>{dirty ? "LaTeX sync: pending" : "LaTeX sync: active"}</span>
          <span>•</span>
          <span>Press Cmd+S to save file</span>
        </div>
      </div>
    </div>
  )
})
