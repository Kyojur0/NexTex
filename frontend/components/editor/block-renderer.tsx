"use client"

import { memo, useCallback } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { getPlugin } from "@/lib/visual-editor/plugins"
import type { AnyVisualBlock, BlockType } from "@/lib/visual-editor/types"
import { cn } from "@/lib/utils"
import { Copy, Trash2, GripVertical } from "lucide-react"

interface BlockRendererProps {
  block: AnyVisualBlock
  isActive: boolean
  isOverlay?: boolean
  index: number
  total: number
  onChange: (id: string, data: unknown) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onFocus: (id: string) => void
  onBlur: () => void
  onSplit?: (id: string, beforeData: unknown, afterData: unknown) => void
  onMergeUp?: (id: string) => void
  onInsertAfter?: (id: string, type: BlockType) => void
  onMoveUp?: (id: string) => void
  onMoveDown?: (id: string) => void
}

export const BlockRenderer = memo(function BlockRenderer({
  block,
  isActive,
  isOverlay,
  index,
  total,
  onChange,
  onDelete,
  onDuplicate,
  onFocus,
  onBlur,
  onSplit,
  onMergeUp,
  onInsertAfter,
  onMoveUp,
  onMoveDown,
}: BlockRendererProps) {
  const plugin = getPlugin(block.type)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id, data: { type: block.type } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging || isOverlay ? 50 : "auto" as const,
  }

  const handleChange   = useCallback((data: unknown)                           => onChange(block.id, data),            [block.id, onChange])
  const handleSplit    = useCallback((b: unknown, a: unknown)                  => onSplit?.(block.id, b, a),           [block.id, onSplit])
  const handleMergeUp  = useCallback(()                                         => onMergeUp?.(block.id),              [block.id, onMergeUp])
  const handleInsertAfter = useCallback((type: BlockType)                       => onInsertAfter?.(block.id, type),    [block.id, onInsertAfter])

  const editor = plugin.renderEditor({
    block,
    isActive,
    onChange: handleChange,
    onSplit:       plugin.isText ? handleSplit    : undefined,
    onMergeUp:     plugin.isText ? handleMergeUp  : undefined,
    onInsertAfter: handleInsertAfter,
    onFocus: () => onFocus(block.id),
    onBlur,
  })

  const LABEL = plugin.label.toUpperCase()

  return (
    <div
      ref={setNodeRef}
      data-testid="block-card"
      style={{
        ...style,
        /* Fable5 block frame */
        position: "relative",
        borderLeft: `3px solid ${isActive ? "var(--primary)" : "transparent"}`,
        borderRadius: "2px 4px 4px 2px",
        padding: "8px 14px 8px 15px",
        margin: "0 -14px 0 -18px",
        background: isActive
          ? "rgba(196,69,40,0.055)"
          : undefined,
        transition: "background 0.12s, border-color 0.12s",
      }}
      className={cn(
        "group",
        !isActive && "hover:[background:var(--visual-editor-block-hover)]",
      )}
      onClick={() => onFocus(block.id)}
    >
      {/* ── Drag handle — left side, vertically centered ── */}
      {!isOverlay && (
        <button
          type="button"
          {...(attributes as React.ButtonHTMLAttributes<HTMLButtonElement>)}
          {...(listeners as React.ButtonHTMLAttributes<HTMLButtonElement>)}
          aria-label="Drag to reorder"
          title="Drag to reorder"
          style={{
            position: "absolute",
            left: "-26px",
            top: "50%",
            transform: "translateY(-50%)",
            width: "20px",
            height: "26px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "4px",
            cursor: "grab",
            opacity: 0,
            transition: "opacity 0.12s",
            color: isActive ? "var(--primary)" : "var(--visual-editor-text-dim)",
            background: isActive ? "rgba(196,69,40,0.10)" : "transparent",
          }}
          className={cn(
            "active:cursor-grabbing",
            "group-hover:!opacity-[0.55]",
            isActive && "!opacity-100",
          )}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}

      {/* ── Floating tools — above block, right-aligned, shown when active ── */}
      {!isOverlay && isActive && (
        <div
          style={{
            position: "absolute",
            top: "-26px",
            right: 0,
            display: "flex",
            alignItems: "center",
            gap: "5px",
            zIndex: 10,
          }}
        >
          {/* Type chip */}
          <div
            style={{
              height: "20px",
              padding: "0 8px",
              display: "flex",
              alignItems: "center",
              background: "var(--primary)",
              color: "#FFF",
              fontSize: "10.5px",
              fontWeight: 600,
              letterSpacing: "0.04em",
              borderRadius: "4px",
            }}
          >
            {LABEL}
          </div>

          {/* Duplicate */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDuplicate(block.id) }}
            title="Duplicate"
            style={{
              width: "20px",
              height: "20px",
              background: "var(--visual-editor-canvas)",
              border: "1px solid var(--visual-editor-toolbar-border)",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--visual-editor-text-dim)",
            }}
            className="hover:!border-[var(--primary)] hover:!text-[var(--primary)]"
          >
            <Copy className="h-2.5 w-2.5" />
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(block.id) }}
            title="Delete"
            style={{
              width: "20px",
              height: "20px",
              background: "var(--visual-editor-canvas)",
              border: "1px solid var(--visual-editor-toolbar-border)",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--visual-editor-text-dim)",
            }}
            className="hover:!border-[var(--primary)] hover:!text-[var(--primary)]"
          >
            <Trash2 className="h-2.5 w-2.5" />
          </button>
        </div>
      )}

      {/* ── Block content ── */}
      <div className="relative">
        {editor}
      </div>
    </div>
  )
})
