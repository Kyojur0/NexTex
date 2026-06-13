"use client"

import { Heading1 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { BlockPlugin } from "../types"

export interface SectionData {
  level: "section" | "subsection" | "subsubsection"
  title: string
}

export const sectionPlugin: BlockPlugin<SectionData> = {
  type: "section",
  label: "Section",
  icon: Heading1,
  defaultData: { level: "section", title: "New Section" },
  renderConfig: ({ block, onChange }) => (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground">Level</label>
        <select
          value={block.data.level}
          onChange={(e) =>
            onChange({ ...block.data, level: e.target.value as SectionData["level"] })
          }
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="section">Section</option>
          <option value="subsection">Subsection</option>
          <option value="subsubsection">Subsubsection</option>
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Title</label>
        <input
          type="text"
          value={block.data.title}
          onChange={(e) => onChange({ ...block.data, title: e.target.value })}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Section title"
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
