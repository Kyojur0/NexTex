"use client"

import { memo, useCallback } from "react"
import { getAllPlugins } from "@/lib/visual-editor/plugins"
import type { BlockType } from "@/lib/visual-editor/types"
import { cn } from "@/lib/utils"
import { Plus } from "lucide-react"

interface BlockSidebarProps {
  onAdd: (type: BlockType) => void
}

export const BlockSidebar = memo(function BlockSidebar({ onAdd }: BlockSidebarProps) {
  const plugins = getAllPlugins()

  return (
    <div className="w-48 shrink-0 flex flex-col border-r border-border/60 bg-card/30 backdrop-blur-sm">
      <div className="px-3 py-2.5 border-b border-border/40">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
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
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs",
                "text-muted-foreground hover:text-foreground",
                "bg-transparent hover:bg-primary/5 hover:shadow-elevated",
                "border border-transparent hover:border-border/40",
                "transition-all duration-150 group text-left"
              )}
            >
              <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                <Icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <span className="truncate font-medium">{plugin.label}</span>
              <Plus className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-60 transition-opacity" />
            </button>
          )
        })}
      </div>
    </div>
  )
})
