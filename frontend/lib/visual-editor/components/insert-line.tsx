"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Plus } from "lucide-react"
import type { BlockType } from "../types"
import { getAllPlugins } from "../plugins"

interface InsertLineProps {
  onInsert: (type: BlockType) => void
}

export function InsertLine({ onInsert }: InsertLineProps) {
  const [open, setOpen] = useState(false)
  const plugins = getAllPlugins()

  return (
    <div
      className="relative h-6 flex items-center justify-center my-1 group/insert"
      onMouseLeave={() => setOpen(false)}
    >
      <div className="absolute inset-x-0 h-px bg-transparent group-hover/insert:bg-[var(--visual-editor-insert-line)] transition-colors duration-150" />

      <div
        className={cn(
          "relative z-10 flex items-center justify-center",
          "opacity-0 group-hover/insert:opacity-100 transition-opacity duration-150",
          open && "opacity-100"
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="h-5 w-5 rounded-full bg-[var(--visual-editor-toolbar)] border border-[var(--visual-editor-toolbar-border)] text-[var(--visual-editor-text-dim)] hover:text-[var(--visual-editor-text)] flex items-center justify-center transition-colors"
        >
          <Plus className="h-3 w-3" />
        </button>

        {open && (
          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 p-1.5 rounded-xl border border-[var(--visual-editor-toolbar-border)] bg-[var(--visual-editor-toolbar)] shadow-floating flex items-center gap-1 z-50">
            {plugins.map((plugin) => {
              const Icon = plugin.icon
              return (
                <button
                  key={plugin.type}
                  type="button"
                  onClick={() => {
                    onInsert(plugin.type)
                    setOpen(false)
                  }}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-[var(--visual-editor-tool-hover)] transition-colors min-w-[60px]"
                  title={plugin.label}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${plugin.color}20`, color: plugin.color }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-[9px] text-[var(--visual-editor-text-dim)] font-medium">{plugin.label}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
