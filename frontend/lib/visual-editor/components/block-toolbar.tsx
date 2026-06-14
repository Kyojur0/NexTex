"use client"

import { memo } from "react"
import { getPlugin } from "../plugins"
import type { AnyVisualBlock, BlockType } from "../types"
import { cn } from "@/lib/utils"
import { Copy, Trash2, ArrowUp, ArrowDown } from "lucide-react"

interface BlockToolbarProps {
  block: AnyVisualBlock
  canMoveUp: boolean
  canMoveDown: boolean
  onDuplicate: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onChangeType?: (type: BlockType) => void
}

export const BlockToolbar = memo(function BlockToolbar({
  block,
  canMoveUp,
  canMoveDown,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: BlockToolbarProps) {
  const plugin = getPlugin(block.type)
  const Icon = plugin.icon

  return (
    <div
      className={cn(
        "absolute -top-3 right-3 flex items-center gap-0.5",
        "px-1.5 py-1 rounded-lg border border-border/50 bg-card/95 backdrop-blur-sm",
        "shadow-elevated opacity-0 group-hover:opacity-100 focus-within:opacity-100",
        "transition-opacity duration-150 z-50"
      )}
    >
      <div className="flex items-center gap-1 pr-1.5 border-r border-border/40">
        <div
          className="w-5 h-5 rounded-md flex items-center justify-center"
          style={{ backgroundColor: `${plugin.color}20`, color: plugin.color }}
        >
          <Icon className="h-3 w-3" />
        </div>
        <span className="text-[10px] font-medium text-muted-foreground">{plugin.label}</span>
      </div>
      <ToolbarButton onClick={onMoveUp} disabled={!canMoveUp} title="Move up">
        <ArrowUp className="h-3 w-3" />
      </ToolbarButton>
      <ToolbarButton onClick={onMoveDown} disabled={!canMoveDown} title="Move down">
        <ArrowDown className="h-3 w-3" />
      </ToolbarButton>
      <ToolbarButton onClick={onDuplicate} title="Duplicate">
        <Copy className="h-3 w-3" />
      </ToolbarButton>
      <ToolbarButton onClick={onDelete} title="Delete" destructive>
        <Trash2 className="h-3 w-3" />
      </ToolbarButton>
    </div>
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
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "h-6 w-6 flex items-center justify-center rounded-md transition-colors",
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
