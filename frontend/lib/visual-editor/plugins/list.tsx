"use client"

import { List } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  defaultData: { kind: "itemize", items: ["First item", "Second item"] },
  renderConfig: ({ block, onChange }) => {
    const value = block.data.items.join("\n")
    return (
      <div className="space-y-3">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">List type</Label>
          <Select
            value={block.data.kind}
            onValueChange={(value) =>
              onChange({ ...block.data, kind: value as ListData["kind"] })
            }
          >
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="itemize">Bullet list</SelectItem>
              <SelectItem value="enumerate">Numbered list</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Items (one per line)</Label>
          <Textarea
            value={value}
            onChange={(e) =>
              onChange({
                ...block.data,
                items: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
              })
            }
            rows={5}
            className="resize-y text-sm"
            placeholder="First item&#10;Second item"
          />
        </div>
      </div>
    )
  },
  renderPreview: ({ block }) => {
    const ListTag = block.data.kind === "enumerate" ? "ol" : "ul"
    return (
      <ListTag className="list-inside text-sm text-foreground/85 leading-relaxed space-y-0.5">
        {block.data.items.length === 0 ? (
          <li className="italic text-muted-foreground/70">Empty list</li>
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
