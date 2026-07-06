"use client"

import { memo } from "react"
import { cn } from "@/lib/utils"
import { GripVertical, Copy, Trash2 } from "lucide-react"

interface BlockActionBarProps {
  onDuplicate: () => void
  onDelete: () => void
  dragHandleProps?: Record<string, unknown>
}

export const BlockActionBar = memo(function BlockActionBar({
  onDuplicate,
  onDelete,
  dragHandleProps,
}: BlockActionBarProps) {
  return (
    <div
      className={cn(
        "absolute -right-10 top-0 z-20",
        "flex flex-col gap-0.5 p-1 rounded-lg",
        "bg-[var(--visual-editor-toolbar)] border border-[var(--visual-editor-toolbar-border)]",
        "shadow-elevated opacity-0 group-hover:opacity-100 focus-within:opacity-100",
        "transition-opacity duration-150"
      )}
    >
      <button
        type="button"
        {...(dragHandleProps as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        className="h-6 w-6 flex items-center justify-center rounded-md text-[var(--visual-editor-text-dim)] hover:text-[var(--visual-editor-text)] hover:bg-[var(--visual-editor-tool-hover)] transition-colors cursor-grab active:cursor-grabbing"
        title="Drag to reorder"
      >
        <GripVertical className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onDuplicate()
        }}
        className="h-6 w-6 flex items-center justify-center rounded-md text-[var(--visual-editor-text-dim)] hover:text-[var(--visual-editor-text)] hover:bg-[var(--visual-editor-tool-hover)] transition-colors"
        title="Duplicate"
      >
        <Copy className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="h-6 w-6 flex items-center justify-center rounded-md text-[var(--visual-editor-text-dim)] hover:text-destructive hover:bg-destructive/10 transition-colors"
        title="Delete"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  )
})
