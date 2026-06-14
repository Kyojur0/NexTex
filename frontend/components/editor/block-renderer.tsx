"use client"

import { memo, useCallback } from "react"
import { motion } from "framer-motion"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { getPlugin } from "@/lib/visual-editor/plugins"
import type { AnyVisualBlock, BlockType } from "@/lib/visual-editor/types"
import { cn } from "@/lib/utils"
import { GripVertical } from "lucide-react"

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
  const Icon = plugin.icon

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id, data: { type: block.type } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging || isOverlay ? 50 : "auto",
  }

  const handleChange = useCallback(
    (data: unknown) => onChange(block.id, data),
    [block.id, onChange]
  )

  const handleSplit = useCallback(
    (beforeData: unknown, afterData: unknown) => onSplit?.(block.id, beforeData, afterData),
    [block.id, onSplit]
  )

  const handleMergeUp = useCallback(
    () => onMergeUp?.(block.id),
    [block.id, onMergeUp]
  )

  const handleInsertAfter = useCallback(
    (type: BlockType) => onInsertAfter?.(block.id, type),
    [block.id, onInsertAfter]
  )

  const editor = plugin.renderEditor({
    block,
    isActive,
    onChange: handleChange,
    onSplit: plugin.isText ? handleSplit : undefined,
    onMergeUp: plugin.isText ? handleMergeUp : undefined,
    onInsertAfter: handleInsertAfter,
    onFocus: () => onFocus(block.id),
    onBlur,
  })

  return (
    <motion.div
      ref={setNodeRef}
      data-testid="block-card"
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 500, damping: 35, mass: 0.8 }}
      style={{
        ...style,
        borderLeftWidth: "3px",
        borderLeftColor: plugin.color,
      }}
      className={cn(
        "group relative rounded-2xl border bg-card",
        isDragging || isOverlay
          ? "border-primary/30 shadow-floating ring-1 ring-primary/10 opacity-95 rotate-1"
          : "border-border/40 shadow-elevated hover:shadow-floating hover:border-border/60",
        isActive && "ring-1 ring-primary/10 border-border/60"
      )}
      onClick={() => onFocus(block.id)}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/30 bg-muted/30 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground cursor-grab active:cursor-grabbing transition-colors"
            aria-label="Drag to reorder"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center"
            style={{ backgroundColor: `${plugin.color}20`, color: plugin.color }}
          >
            <Icon className="h-3 w-3" />
          </div>
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {plugin.label}
          </span>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <ToolbarButton onClick={() => onMoveUp?.(block.id)} disabled={index === 0} title="Move up">
            ↑
          </ToolbarButton>
          <ToolbarButton onClick={() => onMoveDown?.(block.id)} disabled={index === total - 1} title="Move down">
            ↓
          </ToolbarButton>
          <ToolbarButton onClick={() => onDuplicate(block.id)} title="Duplicate">
            ⧉
          </ToolbarButton>
          <ToolbarButton onClick={() => onDelete(block.id)} title="Delete" destructive>
            ×
          </ToolbarButton>
        </div>
      </div>

      {/* Editor */}
      <div className="px-4 py-3">{editor}</div>
    </motion.div>
  )
})

function ToolbarButton({
  onClick,
  disabled,
  title,
  destructive,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  title: string
  destructive?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      disabled={disabled}
      title={title}
      className={cn(
        "h-6 w-6 flex items-center justify-center rounded-md transition-colors text-xs",
        disabled && "opacity-30 cursor-not-allowed",
        !disabled &&
          (destructive
            ? "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            : "text-muted-foreground hover:text-foreground hover:bg-muted")
      )}
    >
      {children}
    </button>
  )
}
