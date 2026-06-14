"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { getAllPlugins } from "../plugins"
import type { BlockType } from "../types"
import { cn } from "@/lib/utils"

interface SlashCommandMenuProps {
  query: string
  onSelect: (type: BlockType) => void
  onClose: () => void
}

export function SlashCommandMenu({ query, onSelect, onClose }: SlashCommandMenuProps) {
  const plugins = getAllPlugins()
  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return plugins.filter(
      (p) =>
        p.label.toLowerCase().includes(q) ||
        p.type.toLowerCase().includes(q)
    )
  }, [plugins, query])

  const [selectedIndex, setSelectedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (filtered.length === 0) return
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((i) => (i + 1) % filtered.length)
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length)
      } else if (e.key === "Enter") {
        e.preventDefault()
        onSelect(filtered[selectedIndex].type)
      } else if (e.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [filtered, selectedIndex, onSelect, onClose])

  useEffect(() => {
    const el = containerRef.current?.children[selectedIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: "nearest" })
  }, [selectedIndex])

  if (filtered.length === 0) {
    return (
      <div className="p-2 text-xs text-muted-foreground">No matching blocks</div>
    )
  }

  return (
    <div className="py-1 min-w-[180px] max-h-60 overflow-y-auto">
      {filtered.map((plugin, idx) => {
        const Icon = plugin.icon
        return (
          <button
            key={plugin.type}
            ref={idx === selectedIndex ? (el) => el?.scrollIntoView({ block: "nearest" }) : undefined}
            onClick={() => onSelect(plugin.type)}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors",
              idx === selectedIndex
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:bg-muted"
            )}
          >
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${plugin.color}25`, color: plugin.color }}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>
            <span className="font-medium">{plugin.label}</span>
          </button>
        )
      })}
    </div>
  )
}
