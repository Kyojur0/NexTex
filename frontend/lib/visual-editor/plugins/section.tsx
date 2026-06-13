"use client"

import { Heading1 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { BlockPlugin } from "../types"

export interface SectionData {
  level: "section" | "subsection" | "subsubsection"
  title: string
}

export const sectionPlugin: BlockPlugin<SectionData> = {
  type: "section",
  label: "Section",
  icon: Heading1,
  color: "#6366f1",
  defaultData: { level: "section", title: "New Section" },
  renderConfig: ({ block, onChange }) => (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Level</Label>
        <Select
          value={block.data.level}
          onValueChange={(value) =>
            onChange({ ...block.data, level: value as SectionData["level"] })
          }
        >
          <SelectTrigger className="text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="section">Section</SelectItem>
            <SelectItem value="subsection">Subsection</SelectItem>
            <SelectItem value="subsubsection">Subsubsection</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Title</Label>
        <Input
          type="text"
          value={block.data.title}
          onChange={(e) => onChange({ ...block.data, title: e.target.value })}
          placeholder="Section title"
          className="text-sm"
        />
      </div>
    </div>
  ),
  renderPreview: ({ block }) => {
    const sizeClass =
      block.data.level === "section"
        ? "text-base"
        : block.data.level === "subsection"
        ? "text-sm"
        : "text-xs"
    return (
      <div className="flex items-baseline gap-2 min-w-0">
        <span className={cn("text-[10px] font-bold uppercase tracking-wider text-primary/70 shrink-0", sizeClass)}>
          {block.data.level}
        </span>
        <h3 className={cn("font-semibold tracking-tight text-foreground truncate", sizeClass)}>
          {block.data.title || <span className="italic text-muted-foreground">Untitled section</span>}
        </h3>
      </div>
    )
  },
  toLaTeX: (data) => `\\${data.level}{${data.title.trim()}}`,
}
