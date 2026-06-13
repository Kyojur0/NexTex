"use client"

import { memo, useCallback } from "react"
import { getAllPlugins } from "@/lib/visual-editor/plugins"
import type { BlockType } from "@/lib/visual-editor/types"
import { cn } from "@/lib/utils"

interface BlockSidebarProps {
  onAdd: (type: BlockType) => void
}

export const BlockSidebar = memo(function BlockSidebar({ onAdd }: BlockSidebarProps) {
  const plugins = getAllPlugins()

  return (
    <div className="w-56 shrink-0 flex flex-col border-r border-border/60 bg-muted/10">
      <div className="px-3 py-2.5 border-b border-border/40">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Block Palette
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {plugins.map((plugin) => {
          const Icon = plugin.icon
          return (
            <button
              key={plugin.type}
              data-testid={`block-palette-button-${plugin.label}`}
              onClick={() => onAdd(plugin.type)}
              className={cn(
                "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs text-muted-foreground",
                "hover:text-foreground hover:bg-muted/60 transition-colors group text-left"
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 group-hover:text-foreground/80" />
              <span className="truncate">{plugin.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
})
