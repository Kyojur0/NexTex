"use client"

import { useCallback } from "react"
import { List, Plus, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import type { BlockPlugin } from "../types"

export interface ListData {
  kind: "itemize" | "enumerate"
  items: string[]
}

export const listPlugin: BlockPlugin<ListData> = {
  type: "list",
  label: "List",
  icon: List,
  color: "#10b981",
  defaultData: { kind: "itemize", items: [""] },
  isText: false,
  renderEditor: ({ block, isActive, onChange, onFocus, onBlur }) => {
    const { kind, items } = block.data

    const updateItem = useCallback(
      (idx: number, value: string) => {
        const next = [...items]
        next[idx] = value
        onChange({ ...block.data, items: next })
      },
      [items, block.data, onChange]
    )

    const addItem = useCallback(
      (idx: number) => {
        const next = [...items]
        next.splice(idx + 1, 0, "")
        onChange({ ...block.data, items: next })
      },
      [items, block.data, onChange]
    )

    const removeItem = useCallback(
      (idx: number) => {
        const next = items.filter((_, i) => i !== idx)
        onChange({ ...block.data, items: next.length ? next : [""] })
      },
      [items, block.data, onChange]
    )

    return (
      <div className="space-y-2">
        {isActive && (
          <div className="flex items-center gap-2 mb-2">
            <Select
              value={kind}
              onValueChange={(value) => onChange({ ...block.data, kind: value as ListData["kind"] })}
            >
              <SelectTrigger className="h-8 text-xs w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="itemize">Bullet list</SelectItem>
                <SelectItem value="enumerate">Numbered list</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div
          className={kind === "enumerate" ? "list-decimal list-inside" : "list-disc list-inside"}
          onFocus={onFocus}
          onBlur={onBlur}
        >
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 group/item">
              <span className="text-sm text-foreground/70 select-none">
                {kind === "enumerate" ? `${idx + 1}.` : "•"}
              </span>
              <Input
                value={item}
                onChange={(e) => updateItem(idx, e.target.value)}
                placeholder="List item"
                className="flex-1 h-7 text-sm border-0 bg-transparent px-1 focus-visible:ring-1 focus-visible:ring-primary/30"
              />
              {isActive && (
                <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => addItem(idx)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeItem(idx)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  },
  toLaTeX: (data) => {
    if (data.items.length === 0) return `\\begin{${data.kind}}\n\\end{${data.kind}}`
    const body = data.items.map((item) => `  \\item ${item.trim()}`).join("\n")
    return `\\begin{${data.kind}}\n${body}\n\\end{${data.kind}}`
  },
}
