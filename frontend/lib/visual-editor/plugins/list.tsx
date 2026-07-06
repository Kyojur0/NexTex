"use client"

import { useCallback } from "react"
import { List as ListIcon } from "lucide-react"
import type { BlockPlugin } from "../types"
import { InlineText } from "../components/inline-text"

export interface ListData {
  kind: "itemize" | "enumerate"
  items: string[]
}

export const listPlugin: BlockPlugin<ListData> = {
  type: "list",
  label: "List",
  icon: ListIcon,
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

    const ListTag = kind === "enumerate" ? "ol" : "ul"
    const listClass = kind === "enumerate" ? "list-decimal" : "list-disc"

    return (
      <div className="py-1" onFocus={onFocus} onBlur={onBlur}>
        <ListTag className={`${listClass} pl-6 space-y-1 font-serif`}>
          {items.map((item, idx) => (
            <li key={idx} className="text-base leading-7 text-[var(--visual-editor-text)]">
              <div className="flex items-start gap-2 group/item">
                <InlineText
                  value={item}
                  onChange={(value) => updateItem(idx, value)}
                  className="flex-1 text-[var(--visual-editor-text)] outline-none"
                  placeholder="List item"
                  multiline={false}
                />
                {isActive && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => addItem(idx)}
                      className="h-5 px-1.5 rounded-md text-[10px] text-[var(--visual-editor-text-dim)] hover:text-[var(--visual-editor-text)] hover:bg-[var(--visual-editor-tool-hover)] transition-colors"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="h-5 px-1.5 rounded-md text-[10px] text-[var(--visual-editor-text-dim)] hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      −
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ListTag>
      </div>
    )
  },
  toLaTeX: (data) => {
    if (data.items.length === 0) return `\\begin{${data.kind}}\n\\end{${data.kind}}`
    const body = data.items.map((item) => `  \\item ${item.trim()}`).join("\n")
    return `\\begin{${data.kind}}\n${body}\n\\end{${data.kind}}`
  },
}
