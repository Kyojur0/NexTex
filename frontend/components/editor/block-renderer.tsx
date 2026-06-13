"use client"

import { memo, useState, useCallback } from "react"
import { motion } from "framer-motion"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { getPlugin } from "@/lib/visual-editor/plugins"
import type { AnyVisualBlock } from "@/lib/visual-editor/types"
import { cn } from "@/lib/utils"
import {
  GripVertical,
  Trash2,
  Copy,
  ChevronDown,
  ChevronRight,
} from "lucide-react"

interface BlockRendererProps {
  block: AnyVisualBlock
  isOverlay?: boolean
  onChange: (id: string, data: unknown) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
}

export const BlockRenderer = memo(function BlockRenderer({
  block,
  isOverlay,
  onChange,
  onDelete,
  onDuplicate,
}: BlockRendererProps) {
  const [showConfig, setShowConfig] = useState(false)
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
    (data: unknown) => {
      onChange(block.id, data)
    },
    [block.id, onChange]
  )

  const preview = plugin.renderPreview({ block })
  const config = plugin.renderConfig({ block, onChange: handleChange })

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
          : "border-border/40 shadow-elevated hover:shadow-floating hover:border-border/60"
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/30 bg-muted/30 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground cursor-grab active:cursor-grabbing transition-colors"
            aria-label="Drag to reorder"
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
        <div className="flex items-center gap-0.5">
          <button
            data-testid="toggle-config"
            onClick={() => setShowConfig((s) => !s)}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title={showConfig ? "Hide config" : "Show config"}
          >
            {showConfig ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            data-testid="duplicate-block"
            onClick={() => onDuplicate(block.id)}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Duplicate"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            data-testid="delete-block"
            onClick={() => onDelete(block.id)}
            className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="px-4 py-3">{preview}</div>

      {/* Config form */}
      {showConfig && (
        <div className="px-4 py-3 border-t border-border/30 bg-muted/20 rounded-b-2xl">
          {config}
        </div>
      )}
    </motion.div>
  )
})
