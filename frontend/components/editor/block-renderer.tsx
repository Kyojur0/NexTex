"use client"

import { memo, useCallback } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { getPlugin } from "@/lib/visual-editor/plugins"
import type { AnyVisualBlock, BlockType } from "@/lib/visual-editor/types"
import { cn } from "@/lib/utils"
import { BlockActionBar } from "@/lib/visual-editor/components/block-action-bar"

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
    <div
      ref={setNodeRef}
      data-testid="block-card"
      style={style}
      className={cn(
        "group relative mb-4 transition-colors duration-150",
        isDragging || isOverlay
          ? "opacity-95 rotate-1 shadow-floating"
          : "hover:bg-[var(--visual-editor-block-hover)]",
        isActive && "bg-[var(--visual-editor-block-hover)]"
      )}
      onClick={() => onFocus(block.id)}
    >
      {!isOverlay && (
        <BlockActionBar
          onDuplicate={() => onDuplicate(block.id)}
          onDelete={() => onDelete(block.id)}
          dragHandleProps={{ ...attributes, ...listeners }}
        />
      )}

      <div className="relative">
        {editor}
      </div>
    </div>
  )
})
