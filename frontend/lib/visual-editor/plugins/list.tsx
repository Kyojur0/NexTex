"use client"

import { List } from "lucide-react"
import type { BlockPlugin } from "../types"

export interface ListData {
  kind: "itemize" | "enumerate"
  items: string[]
}

export const listPlugin: BlockPlugin<ListData> = {
  type: "list",
  label: "List",
  icon: List,
  defaultData: { kind: "itemize", items: ["First item", "Second item"] },
  renderConfig: ({ block, onChange }) => {
    const value = block.data.items.join("\n")
    return (
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">List type</label>
          <select
            value={block.data.kind}
            onChange={(e) =>
              onChange({ ...block.data, kind: e.target.value as ListData["kind"] })
            }
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="itemize">Bullet list</option>
            <option value="enumerate">Numbered list</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Items (one per line)</label>
          <textarea
            value={value}
            onChange={(e) =>
              onChange({
                ...block.data,
                items: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
              })
            }
            rows={5}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-sans resize-y focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="First item&#10;Second item"
          />
        </div>
      </div>
    )
  },
  renderPreview: ({ block }) => {
    const ListTag = block.data.kind === "enumerate" ? "ol" : "ul"
    return (
      <ListTag className="list-inside text-sm text-foreground/90 leading-relaxed space-y-0.5">
        {block.data.items.length === 0 ? (
          <li className="italic text-muted-foreground">Empty list</li>
        ) : (
          block.data.items.map((item, i) => <li key={i}>{item}</li>)
        )}
      </ListTag>
    )
  },
  toLaTeX: (data) => {
    if (data.items.length === 0) return `\\begin{${data.kind}}\n\\end{${data.kind}}`
    const body = data.items.map((item) => `  \\item ${item.trim()}`).join("\n")
    return `\\begin{${data.kind}}\n${body}\n\\end{${data.kind}}`
  },
}
