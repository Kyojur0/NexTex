"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { getAllPlugins } from "../plugins"
import type { BlockType } from "../types"
import { cn } from "@/lib/utils"
import { Plus } from "lucide-react"

interface InsertBlockButtonProps {
  onInsert: (type: BlockType) => void
}

export function InsertBlockButton({ onInsert }: InsertBlockButtonProps) {
  const [open, setOpen] = useState(false)
  const plugins = getAllPlugins()

  return (
    <div className="relative h-0 flex items-center justify-center my-1">
      <div
        className={cn(
          "absolute z-10 flex items-center transition-opacity duration-150",
          open ? "opacity-100" : "opacity-0 hover:opacity-100"
        )}
      >
        <button
          onClick={() => setOpen((o) => !o)}
          className="h-6 w-6 rounded-full bg-card border border-border/60 shadow-elevated flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -5, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5, scale: 0.95 }}
              className="absolute left-8 top-1/2 -translate-y-1/2 flex items-center gap-1 p-1.5 rounded-xl border border-border/60 bg-card shadow-floating"
            >
              {plugins.map((plugin) => {
                const Icon = plugin.icon
                return (
                  <button
                    key={plugin.type}
                    onClick={() => {
                      onInsert(plugin.type)
                      setOpen(false)
                    }}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-muted transition-colors min-w-[56px]"
                    title={plugin.label}
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${plugin.color}20`, color: plugin.color }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[9px] text-muted-foreground font-medium">{plugin.label}</span>
                  </button>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="w-full h-px bg-border/30 group-hover:bg-border/60 transition-colors" />
    </div>
  )
}
